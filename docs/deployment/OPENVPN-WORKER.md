# The Privileged OpenVPN Worker

OpenVPN monitors are the one component that needs more than a plain container:
creating a tun device and installing routes requires `CAP_NET_ADMIN`, and the
`openvpn` binary must exist in the image. This document explains exactly what
is granted, how routing is kept safe, and how to verify the setup.

## What the worker can do (and why it's needed)

| Requirement                         | Reason                                         |
| ----------------------------------- | ---------------------------------------------- |
| `--cap-add NET_ADMIN`               | Create the tun interface, add /32 routes       |
| `--device /dev/net/tun`             | Kernel tunnel device                           |
| `openvpn` + `iproute2` in the image | Provided by the `openvpn-runner` Docker target |

That capability set lets the container manipulate **its own** network stack.
It cannot touch the host's networking or other containers. Keep this worker
dedicated to tunnel duty — the API and the SSH worker run **without** extra
privileges.

## How routing stays contained

1. OpenVPN starts with `--route-nopull` — the VPN **never** installs a default
   route, so database/Redis/SMTP traffic keeps flowing normally.
2. Each monitor target gets an explicit `ip route replace <target-ip>/32 dev upkeepT<tunnel>`
   route — only those hosts traverse the VPN.
3. Each tunnel gets a **named device** (`upkeepT<id-prefix>`) so concurrent VPNs
   never collide.
4. The config is **sanitized against a directive allowlist** before it reaches
   disk (see [../architecture/credential-sources.md](../architecture/credential-sources.md)):
   `up`, `route-up`, `iproute`, `script-security`, `http-proxy`, `user`,
   `chroot`, custom `<blocks>` etc. are rejected — both at upload time (clear
   validation error) and again before every start (defense in depth). This
   closes the obvious path from "user pastes a config" to "code execution on a
   root-capable container".

Known v1 limitation: two simultaneous VPNs routing the **same overlapping
target subnet** conflict (last route wins). Per-tunnel network namespaces are
the planned fix; the manager interface is shaped to absorb that change.

## Running it

```bash
docker compose -f compose.prod.yml --profile openvpn up -d openvpn-worker
```

or manually:

```bash
docker build -t upkeep-api:openvpn --target openvpn-runner -f apps/api/Dockerfile .
docker run -d --name upkeep-openvpn-worker \
  --cap-add NET_ADMIN --device /dev/net/tun \
  --env-file apps/api/.env -e UPKEEP_ROLE=worker \
  upkeep-api:openvpn
```

> On some hosts `/dev/net/tun` must be created first:
> `mkdir -p /dev/net && mknod /dev/net/tun c 10 200 && chmod 666 /dev/net/tun`.
> Most modern distributions ship it already. (Kernel modules `tun` must be
> available; standard on KVM/cloud VMs, sometimes unavailable on OpenVZ.)

## Verifying

```bash
# inside the container
docker exec -it upkeep-openvpn-worker sh
ip link show upkeepT<tunnel-id-prefix>     # tun device exists when a VPN is up
ip route                                   # only /32 target routes, no default via tun
openvpn --version

# from the app: create an OpenVPN tunnel (Tunnels page), attach a monitor to
# it, then "Check now". The tunnel badge flips to CONNECTED and the monitor
# records real checks through the VPN.
```

If the binary is missing on a custom image, monitors fail with a clear
`route install failed`/`openvpn exited` error surfaced on the tunnel row —
the engine never crashes over it.
