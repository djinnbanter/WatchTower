package dev.mcstatus.watchtower.core.collect;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

/**
 * Minecraft Source RCON client (stdlib socket, ported from mc-status-rcon.py).
 */
public final class RconClient {

    private static final int SERVERDATA_AUTH = 3;
    private static final int SERVERDATA_EXECCOMMAND = 2;
    private static final int SERVERDATA_RESPONSE_VALUE = 0;

    private RconClient() {
    }

    public static String command(String host, int port, String password, String command, int timeoutMs)
            throws RconException {
        try (Socket sock = new Socket()) {
            sock.connect(new InetSocketAddress(host, port), timeoutMs);
            sock.setSoTimeout(timeoutMs);
            sendPacket(sock, 1, SERVERDATA_AUTH, password);
            Packet auth = recvPacket(sock);
            if (auth.requestId == -1) {
                throw new RconException("RCON authentication failed");
            }
            sendPacket(sock, 2, SERVERDATA_EXECCOMMAND, command);
            StringBuilder parts = new StringBuilder();
            while (true) {
                Packet resp = recvPacket(sock);
                if (resp.type == SERVERDATA_RESPONSE_VALUE && resp.payload != null && !resp.payload.isEmpty()) {
                    if (!parts.isEmpty()) {
                        parts.append('\n');
                    }
                    parts.append(resp.payload);
                }
                if (resp.type != SERVERDATA_RESPONSE_VALUE) {
                    break;
                }
            }
            return parts.toString().strip();
        } catch (IOException e) {
            throw new RconException(e.getMessage() != null ? e.getMessage() : "RCON I/O error", e);
        }
    }

    private static void sendPacket(Socket sock, int requestId, int type, String payload) throws IOException {
        byte[] bodyBytes = payload.getBytes(StandardCharsets.UTF_8);
        ByteBuffer body = ByteBuffer.allocate(8 + bodyBytes.length + 2).order(ByteOrder.LITTLE_ENDIAN);
        body.putInt(requestId);
        body.putInt(type);
        body.put(bodyBytes);
        body.put((byte) 0);
        body.put((byte) 0);
        byte[] bodyArray = body.array();
        ByteBuffer header = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN);
        header.putInt(bodyArray.length);
        OutputStream out = sock.getOutputStream();
        out.write(header.array());
        out.write(bodyArray);
        out.flush();
    }

    private static Packet recvPacket(Socket sock) throws IOException {
        InputStream in = sock.getInputStream();
        byte[] lenBuf = readFully(in, 4);
        int length = ByteBuffer.wrap(lenBuf).order(ByteOrder.LITTLE_ENDIAN).getInt();
        byte[] body = readFully(in, length);
        ByteBuffer buf = ByteBuffer.wrap(body).order(ByteOrder.LITTLE_ENDIAN);
        int requestId = buf.getInt();
        int type = buf.getInt();
        int payloadLen = Math.max(0, length - 10);
        String payload = payloadLen > 0
                ? new String(body, 8, payloadLen, StandardCharsets.UTF_8)
                : "";
        return new Packet(requestId, type, payload);
    }

    private static byte[] readFully(InputStream in, int length) throws IOException {
        byte[] buf = new byte[length];
        int off = 0;
        while (off < length) {
            int read = in.read(buf, off, length - off);
            if (read < 0) {
                throw new IOException("RCON connection closed");
            }
            off += read;
        }
        return buf;
    }

    private record Packet(int requestId, int type, String payload) {
    }

    public static final class RconException extends Exception {
        public RconException(String message) {
            super(message);
        }

        public RconException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
