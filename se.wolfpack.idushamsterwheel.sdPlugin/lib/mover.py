#!/usr/bin/env python3
"""Idus Hamster Wheel - moves the mouse pointer through a small virtual mouse (/dev/uinput).

Works on Wayland and X11 alike: the desktop sees an ordinary mouse called "Idus Hamster Wheel".
Started by the plugin while the wheel runs. One command per line on stdin:
    seq DX,DY,MS DX,DY,MS ...   move DX,DY (relative), then wait MS milliseconds - step by step
    quit
Prints "ready" when the virtual mouse exists, "done" after each seq, or "error <kind> <text>" and
exits (kind: access, missing, other). Removes the virtual mouse and exits when stdin closes, so it
never outlives the plugin. Moves are capped at 50 per step and waits at 2 s.
IDUS_HW_DRYRUN=1: no device - every event is printed as "ev <type> <code> <value>" (tests).
Only the Python standard library; never needs root (your user needs write access to /dev/uinput).
"""
import errno
import fcntl
import os
import struct
import sys
import time

UI_SET_EVBIT, UI_SET_KEYBIT, UI_SET_RELBIT = 0x40045564, 0x40045565, 0x40045566
UI_DEV_SETUP, UI_DEV_CREATE, UI_DEV_DESTROY = 0x405C5503, 0x5501, 0x5502  # _IOW('U', 3, uinput_setup) = 92 bytes
EV_SYN, EV_KEY, EV_REL = 0x00, 0x01, 0x02
SYN_REPORT, REL_X, REL_Y = 0, 0x00, 0x01
BTN_LEFT, BTN_RIGHT = 0x110, 0x111
BUS_VIRTUAL = 0x06
NAME = b"Idus Hamster Wheel"
DRY = os.environ.get("IDUS_HW_DRYRUN") == "1"


def say(line):
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def open_device():
    fd = os.open("/dev/uinput", os.O_WRONLY | os.O_NONBLOCK)
    try:
        fcntl.ioctl(fd, UI_SET_EVBIT, EV_KEY)
        for btn in (BTN_LEFT, BTN_RIGHT):  # buttons make the desktop treat it as a mouse; never pressed
            fcntl.ioctl(fd, UI_SET_KEYBIT, btn)
        fcntl.ioctl(fd, UI_SET_EVBIT, EV_REL)
        fcntl.ioctl(fd, UI_SET_RELBIT, REL_X)
        fcntl.ioctl(fd, UI_SET_RELBIT, REL_Y)
        fcntl.ioctl(fd, UI_DEV_SETUP, struct.pack("HHHH80sI", BUS_VIRTUAL, 0x1209, 0x4857, 1, NAME, 0))
        fcntl.ioctl(fd, UI_DEV_CREATE)
    except OSError:
        os.close(fd)
        raise
    return fd


def emit(fd, typ, code, value):
    if DRY:
        say(f"ev {typ} {code} {value}")
        if os.environ.get("IDUS_HW_DRYLOG"):
            with open(os.environ["IDUS_HW_DRYLOG"], "a") as log:
                log.write(f"{time.time():.3f} {typ} {code} {value}\n")
        return
    os.write(fd, struct.pack("llHHi", 0, 0, typ, code, value))  # struct input_event (time 0 = now)


def move(fd, dx, dy):
    if dx:
        emit(fd, EV_REL, REL_X, dx)
    if dy:
        emit(fd, EV_REL, REL_Y, dy)
    emit(fd, EV_SYN, SYN_REPORT, 0)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def main():
    fd = None
    if not DRY:
        try:
            fd = open_device()
        except OSError as e:
            if e.errno in (errno.EACCES, errno.EPERM):
                kind = "access"
            elif e.errno in (errno.ENOENT, errno.ENODEV, errno.ENXIO):
                kind = "missing"
            else:
                kind = "other"
            say(f"error {kind} {e.strerror or e}")
            return 2
        time.sleep(0.4)  # let the desktop pick up the new mouse before the first move
    say("ready")
    try:
        for line in sys.stdin:
            parts = line.split()
            if not parts:
                continue
            if parts[0] == "quit":
                break
            if parts[0] != "seq":
                continue
            for step in parts[1:]:
                try:
                    dx, dy, ms = (int(x) for x in step.split(","))
                except ValueError:
                    continue
                move(fd, clamp(dx, -50, 50), clamp(dy, -50, 50))
                if ms > 0:
                    time.sleep(clamp(ms, 0, 2000) / 1000)
            say("done")
    except OSError as e:
        say(f"error other {e.strerror or e}")
        return 3
    finally:
        if fd is not None:
            try:
                fcntl.ioctl(fd, UI_DEV_DESTROY)
            except OSError:
                pass
            os.close(fd)
    return 0


if __name__ == "__main__":
    sys.exit(main())
