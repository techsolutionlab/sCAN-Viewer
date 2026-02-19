/**
 * NativeScript Worker – sACN UDP Listener.
 */

export {};

const _g = globalThis as any;

const SACN_PORT        = 5568;
const RECV_BUFFER_SIZE = 638; // max E1.31 packet size

let running = false;

// ── Worker entry point ────────────────────────────────────────────────────

_g.onmessage = (msg: { data: { cmd: string } }): void => {
  const cmd = msg?.data?.cmd;

  if (cmd === 'start' && !running) {
    running = true;
    if (typeof _g.java !== 'undefined') {
      listenAndroid();
    } else if (typeof _g.NSObject !== 'undefined') {
      listenIos();
    } else {
      emit({ type: 'error', message: 'No native UDP runtime detected (not Android or iOS).' });
    }
  }

  if (cmd === 'stop') {
    running = false;
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Android – java.net.MulticastSocket
// ─────────────────────────────────────────────────────────────────────────

function listenAndroid(): void {
  /**
   * Uses Java's MulticastSocket (blocking receive with a 500 ms timeout so
   * we can poll the `running` flag between receives).
   */
  emit({ type: 'ready' });

  try {
    const socket: any = new _g.java.net.MulticastSocket(SACN_PORT);
    socket.setReuseAddress(true);
    socket.setSoTimeout(500); // poll `running` every 500 ms

    // Join sACN multicast groups for universes 1-255.
    // Universe U → 239.255.(U>>8).(U&0xFF); low universes use 239.255.0.x.
    for (let u = 1; u <= 255; u++) {
      try {
        const addr = _g.java.net.InetAddress.getByName(`239.255.0.${u}`);
        socket.joinGroup(addr);
      } catch (_) { /* ignore individual join failures */ }
    }

    const buffer: any = _g.Array.create('byte', RECV_BUFFER_SIZE);
    const packet: any = new _g.java.net.DatagramPacket(buffer, buffer.length);

    while (running) {
      try {
        socket.receive(packet);

        const javaData: any = packet.getData();
        const len: number   = packet.getLength();
        const raw: number[] = new Array<number>(len);
        for (let i = 0; i < len; i++) {
          raw[i] = (javaData[i] & 0xff) as number;
        }
        emit({ type: 'packet', data: raw });

      } catch (e: any) {
        // SocketTimeoutException fires every 500 ms by design — it is the
        // mechanism that lets us re-check the `running` flag.
        if (!String(e).includes('SocketTimeoutException')) {
          emit({ type: 'error', message: String(e) });
          running = false;
        }
      }
    }

    socket.close();

  } catch (err: any) {
    emit({ type: 'error', message: `Android: ${String(err)}` });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// iOS – POSIX BSD sockets via NativeScript's C interop
// ─────────────────────────────────────────────────────────────────────────

function listenIos(): void {
  const AF_INET           = 2;
  const SOCK_DGRAM        = 2;
  const SOL_SOCKET        = 0xffff;
  const SO_REUSEADDR      = 0x0004;
  const SO_REUSEPORT      = 0x0200;
  const SO_RCVTIMEO       = 0x1006;
  const IPPROTO_IP        = 0;
  const IP_ADD_MEMBERSHIP = 12;

  /** Allocate a zeroed NSMutableData buffer and return it together with a
   *  Uint8Array view that shares the same underlying memory. */
  function makeBuffer(size: number): { nsdata: any; view: Uint8Array } {
    const nsdata = _g.NSMutableData.dataWithLength(size);
    const view   = new Uint8Array(_g.interop.bufferFromData(nsdata));
    return { nsdata, view };
  }

  /** Write a little-endian uint32 into a Uint8Array at `offset`. */
  function writeLE32(view: Uint8Array, offset: number, value: number): void {
    view[offset]     =  value        & 0xff;
    view[offset + 1] = (value >>  8) & 0xff;
    view[offset + 2] = (value >> 16) & 0xff;
    view[offset + 3] = (value >> 24) & 0xff;
  }

  /** Set an int-valued socket option. */
  function setSockOptInt(fd: number, level: number, opt: number, val: number): void {
    const { nsdata, view } = makeBuffer(4);
    writeLE32(view, 0, val);
    _g.setsockopt(fd, level, opt, nsdata.bytes, 4);
  }

  // ── Create socket ─────────────────────────────────────────────────────

  const fd: number = _g.socket(AF_INET, SOCK_DGRAM, 0);
  if (fd < 0) {
    emit({ type: 'error', message: 'iOS: socket() failed' });
    return;
  }

  try {
    setSockOptInt(fd, SOL_SOCKET, SO_REUSEADDR, 1);
    setSockOptInt(fd, SOL_SOCKET, SO_REUSEPORT, 1);

    const { nsdata: tvData, view: tvView } = makeBuffer(16);
    tvView[8]  = 0x20; tvView[9]  = 0xA1; tvView[10] = 0x07; tvView[11] = 0x00;
    _g.setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, tvData.bytes, 16);

    const { nsdata: bindData, view: bindView } = makeBuffer(16);
    bindView[0] = 16;    // sin_len
    bindView[1] = AF_INET; // sin_family
    bindView[2] = 0x15;  // sin_port high byte
    bindView[3] = 0xC0;  // sin_port low byte

    if (_g.bind(fd, bindData.bytes, 16) < 0) {
      emit({ type: 'error', message: 'iOS: bind() failed' });
      _g.close(fd);
      return;
    }

    // ── Join multicast groups for universes 1-255 ───────────────────────
    // Multicast address 239.255.0.u stored big-endian (network order)
    const { nsdata: mreqData, view: mreqView } = makeBuffer(8);
    mreqView[0] = 239; mreqView[1] = 255;
    mreqView[2] = 0;

    for (let u = 1; u <= 255; u++) {
      mreqView[3] = u;
      _g.setsockopt(fd, IPPROTO_IP, IP_ADD_MEMBERSHIP, mreqData.bytes, 8);
    }

    emit({ type: 'ready' });

    // `recvView` is a stable Uint8Array backed by the same memory that
    const { nsdata: recvData, view: recvView } = makeBuffer(RECV_BUFFER_SIZE);

    while (running) {
      const n: number = _g.recv(fd, recvData.mutableBytes, RECV_BUFFER_SIZE, 0);
      if (n > 0) {
        const raw: number[] = new Array<number>(n);
        for (let i = 0; i < n; i++) {
          raw[i] = recvView[i];
        }
        emit({ type: 'packet', data: raw });
      }
    }

    _g.close(fd);

  } catch (err: any) {
    emit({ type: 'error', message: `iOS: ${String(err)}` });
    _g.close(fd);
  }
}

function emit(msg: object): void {
  _g.postMessage(msg);
}
