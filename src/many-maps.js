import { retrieveVerifiedFromDiscovery } from "./discovery.js";

function nonEmpty(value, code) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
  return value;
}

function normalizeMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_DISCOVERY_MAP");
  }
  if (typeof value.discover !== "function") {
    throw new Error("INVALID_DISCOVERY_MAP_RESOLVER");
  }
  return {
    mapId: nonEmpty(value.mapId, "INVALID_DISCOVERY_MAP_ID"),
    discover: value.discover
  };
}

export async function resolveFromIndependentMaps({
  address,
  maps,
  materializeProvider
}) {
  if (!Array.isArray(maps) || maps.length === 0) {
    throw new Error("DISCOVERY_MAPS_REQUIRED");
  }
  if (typeof materializeProvider !== "function") {
    throw new Error("MAP_PROVIDER_MATERIALIZER_REQUIRED");
  }

  const seenMapIds = new Set();
  const observations = [];

  for (const rawMap of maps) {
    const map = normalizeMap(rawMap);
    if (seenMapIds.has(map.mapId)) {
      throw new Error("DUPLICATE_DISCOVERY_MAP_ID");
    }
    seenMapIds.add(map.mapId);

    try {
      const resolved = await retrieveVerifiedFromDiscovery({
        address,
        discover: map.discover,
        materializeProvider: (candidate) =>
          materializeProvider({
            mapId: map.mapId,
            candidate
          })
      });

      observations.push({
        mapId: map.mapId,
        status: "verified",
        address: resolved.address,
        providerId: resolved.candidate.providerId,
        candidateId: resolved.candidate.candidateId,
        providerKind: resolved.candidate.kind,
        bytes: resolved.bytes,
        attempts: resolved.attempts,
        discovery: resolved.discovery
      });
    } catch (error) {
      observations.push({
        mapId: map.mapId,
        status: "unresolved",
        error: error instanceof Error ? error.message : "map_failed",
        attempts: error?.attempts ?? [],
        discovery: error?.discovery ?? null
      });
    }
  }

  const verified = observations.filter((entry) => entry.status === "verified");
  if (verified.length === 0) {
    const failure = new Error("NO_DISCOVERY_MAP_VERIFIED_SEED");
    failure.maps = observations;
    throw failure;
  }

  // Selection is operational only. It does not define seed identity.
  const selected = verified[0];

  return {
    address,
    bytes: selected.bytes,
    selectedMapId: selected.mapId,
    selectedProviderId: selected.providerId,
    observations,
    convergence: {
      verifiedMapCount: verified.length,
      observedMapCount: observations.length,
      consensusRequired: false,
      identityBasis: "signed-content-address"
    }
  };
}
