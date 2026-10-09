package org.staticcollective.gro.crossing

import org.erdtman.jcs.JsonCanonicalizer
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.Base64

class CrossingVerifierTest {
    private fun jcs(json: JSONObject) = JsonCanonicalizer(json.toString()).encodedString
    private fun keyBytes(number:BigInteger):ByteArray {
        val original=number.toByteArray()
        return if(original.size>=32) original.copyOfRange(original.size-32,original.size)
               else ByteArray(32-original.size)+original
    }
    private fun url(bytes:ByteArray)=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    private fun signedFixture():ByteArray {
        val generator=KeyPairGenerator.getInstance("EC")
        generator.initialize(ECGenParameterSpec("secp256r1"))
        val pair=generator.generateKeyPair()
        val pub=pair.public as ECPublicKey
        val key=JSONObject()
            .put("kty","EC").put("crv","P-256")
            .put("x",url(keyBytes(pub.w.affineX)))
            .put("y",url(keyBytes(pub.w.affineY)))
        val signing=JSONObject()
            .put("algorithm","ECDSA-P256-SHA256")
            .put("public_key",key)
            .put("domain","relatte.crossing-signature/v0")
        val body=JSONObject()
            .put("schema","relatte.crossing-envelope/v0")
            .put("protocol_version","0")
            .put("source_particular","particular:gro-source")
            .put("source_world","world:gro-source")
            .put("source_history_head",JSONObject.NULL)
            .put("parents",JSONArray())
            .put("declared_kind","GRO_NATIVE_CROSSING_002")
            .put("payload_refs",JSONArray())
            .put("requested_effect",JSONObject.NULL)
            .put("capability_ref",JSONObject.NULL)
            .put("privacy_policy",JSONObject.NULL)
            .put("audience_policy",JSONObject.NULL)
            .put("return_address",JSONObject.NULL)
            .put("created_at","2026-10-09T18:00:00.000Z")
            .put("signing",signing)
            .put("extensions",JSONObject().put("note","signed fragment delivery does not admit"))
        val digest=CrossingVerifier.sha256(
            ("reLATTE-CrossingEnvelope-v0|"+jcs(body)).toByteArray(StandardCharsets.UTF_8)
        )
        val id="relatte-crossing-v0:"+digest
        body.put("crossing_id",id)
        val signer=Signature.getInstance("SHA256withECDSAinP1363Format")
        signer.initSign(pair.private)
        signer.update(("reLATTE-CrossingSignature-v0|"+jcs(body))
            .toByteArray(StandardCharsets.UTF_8))
        signing.put("signature",url(signer.sign()))
        return body.toString().toByteArray(StandardCharsets.UTF_8)
    }

    @Test fun nodeGeneratedRelatteFixtureVerifiesOnAndroid() {
        val stream = javaClass.classLoader!!.getResourceAsStream("phone-crossing.json")
            ?: throw AssertionError("Generate the cross-runtime fixture before Gradle tests")
        val bytes=stream.use {it.readBytes()}
        val checked=CrossingVerifier.verify(bytes)
        assertTrue(checked.crossingId.startsWith("relatte-crossing-v0:"))
    }

    @Test fun validSignedCrossingIsVerifiedOnPhone() {
        val fixture=signedFixture()
        val verified=CrossingVerifier.verify(fixture)
        assertTrue(verified.crossingId.startsWith("relatte-crossing-v0:"))
        assertEquals(CrossingVerifier.sha256(fixture),verified.canonicalHash)
        assertArrayEquals(fixture,verified.canonicalBytes)
    }

    @Test fun mutatedWorldOrDeclaredPayloadIsRejected() {
        val input=signedFixture()
        val altered=JSONObject(String(input,StandardCharsets.UTF_8))
        altered.put("source_world","world:attacker")
        assertThrows(IllegalArgumentException::class.java) {
            CrossingVerifier.verify(altered.toString().toByteArray(StandardCharsets.UTF_8))
        }
    }

    @Test fun changedSignatureIsRejectedEvenWithMatchingCrossingId() {
        val input=signedFixture()
        val altered=JSONObject(String(input,StandardCharsets.UTF_8))
        val signing=altered.getJSONObject("signing")
        val raw=Base64.getUrlDecoder().decode(signing.getString("signature"))
        raw[0]=(raw[0].toInt() xor 1).toByte()
        signing.put("signature",url(raw))
        assertThrows(IllegalArgumentException::class.java) {
            CrossingVerifier.verify(altered.toString().toByteArray(StandardCharsets.UTF_8))
        }
    }

    @Test fun unsignedArbitraryJsonCannotEnterInbox() {
        assertThrows(Exception::class.java) {
            CrossingVerifier.verify("{\"hello\":\"phone\"}".toByteArray(StandardCharsets.UTF_8))
        }
    }

    @Test fun oversizeCrossingIsDeniedBeforeParsing() {
        assertThrows(IllegalArgumentException::class.java) {
            CrossingVerifier.verify(ByteArray(256*1024+1))
        }
    }
}
