package org.staticcollective.gro.crossing

import android.content.Context
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.Socket
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * Wi-Fi Direct is only a byte road. A complete on-device P256 verification is
 * mandatory before adding a crossing to inbox. No callback admits it to GrO.
 */
object CrossingWire {
    private const val MAGIC = 0x47524f32 // "GRO2"
    private const val VERSION = 1
    const val PORT = 38842
    private const val MAX = 256 * 1024

    fun send(socket: Socket, bytes: ByteArray) {
        require(bytes.isNotEmpty() && bytes.size <= MAX) { "Invalid frame size" }
        // Never send an unverified crossing.
        CrossingVerifier.verify(bytes)
        socket.soTimeout = 15000
        val output = DataOutputStream(BufferedOutputStream(socket.getOutputStream()))
        output.writeInt(MAGIC)
        output.writeByte(VERSION)
        output.writeInt(bytes.size)
        output.write(java.security.MessageDigest.getInstance("SHA-256").digest(bytes))
        output.write(bytes)
        output.flush()
        val reply = DataInputStream(BufferedInputStream(socket.getInputStream()))
        val status=reply.readUnsignedByte()
        require(status == 1) { "Receiver rejected the signed crossing" }
    }

    fun receive(context: Context, socket: Socket): CrossingVerifier.Verified {
        socket.soTimeout = 15000
        val input=DataInputStream(BufferedInputStream(socket.getInputStream()))
        require(input.readInt() == MAGIC) { "Invalid GrO frame" }
        require(input.readUnsignedByte() == VERSION) { "Protocol version mismatch" }
        val count=input.readInt()
        require(count in 1..MAX) { "Frame size denied" }
        val expected=ByteArray(32)
        input.readFully(expected)
        val bytes=ByteArray(count)
        input.readFully(bytes)
        require(java.security.MessageDigest.getInstance("SHA-256")
            .digest(bytes).contentEquals(expected)) { "Transport integrity failure" }
        // The signature is verified independently of TCP, BLE and Wi-Fi pairing.
        val result=CrossingVerifier.verify(bytes)
        val directory=File(context.filesDir,"crossings").apply { mkdirs() }
        val name=result.canonicalHash+".json"
        val destination=File(directory,name)
        if(!destination.exists()) {
            val staged=File.createTempFile("gro-", ".tmp", directory)
            try {
                staged.outputStream().use { it.write(bytes);it.fd.sync() }
                Files.move(staged.toPath(),destination.toPath(),StandardCopyOption.ATOMIC_MOVE)
            } finally {
                staged.delete()
            }
        }
        // ACK means accepted for local transport storage, NOT R3 RECEIVE/ADMIT.
        DataOutputStream(socket.getOutputStream()).apply { writeByte(1);flush() }
        return result
    }
}
