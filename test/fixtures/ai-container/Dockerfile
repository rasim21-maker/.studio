# Test-only image. No model, package installation, network build or customer code.
FROM postgres:17.7-alpine@sha256:bb377b7239d2774ac8cc76f481596ce96c5a6b5e9d141f6d0a0ee371a6e7c0f2 AS tools
FROM scratch
COPY --from=tools /bin/busybox /bin/busybox
COPY --from=tools /bin/busybox /bin/sh
COPY --from=tools /lib/ /lib/
COPY --chmod=0555 worker /studio/worker
