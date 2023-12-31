w- on [[2023-04-26]], checked out:
    - [Raspberry Pi and PiCam setup (headless)](https://gist.github.com/sageworksstudio/b0954d2d6cfac7d4a00e776953324a2c)
    - [Connect the Camera Module | Getting started with the Camera Module](https://projects.raspberrypi.org/en/projects/getting-started-with-picamera/2)
- [[2023-05-03]]
    - Issue:
        - `vcgencmd get_camera`: `supported=1 detected=1, libcamera interfaces=0`
        - but `libcamera-hello`: `ERROR: *** no cameras available ***`
    - Fix:
        - [Raspberry Pi Documentation - Camera software](https://www.raspberrypi.com/documentation/computers/camera_software.html)
            - > On Raspberry Pi 3 and earlier devices running Bullseye you need to re-enable Glamor in order to make the X-Windows hardware accelerated preview window work. To do this enter sudo raspi-config at a terminal window and then choose Advanced Options, Glamor and Yes. Finally quit raspi-config and let it reboot your Raspberry Pi.
            - > Raspberry Pi 3 and older devices may not by default be using the correct display driver. Refer to the /boot/config.txt file and ensure that either dtoverlay=vc4-fkms-v3d or dtoverlay=vc4-kms-v3d is currently active. Please reboot if you needed to change this.
        - Original reference to
            - [libcamera-apps not working on RPi 3 Model B+ · Issue #125 · raspberrypi/libcamera-apps](https://github.com/raspberrypi/libcamera-apps/issues/125)
            - [Raspbeery (bullseye) && libcamera - Stack Overflow](https://stackoverflow.com/questions/71709549/raspbeery-bullseye-libcamera/71712175#71712175)
    - Usage: `libcamera-hello -t 0` for no timeout
- [[2023-05-08]]
```python
from picamera2 import Picamera2
picam2 = Picamera2()
print(picam2.sensor_modes)
```

```json
[{'format': SRGGB10_CSI2P, 'unpacked': 'SRGGB10', 'bit_depth': 10, 'size': (640, 480), 'fps': 103.33, 'crop_limits': (1000, 752, 1280, 960), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB10_CSI2P, 'unpacked': 'SRGGB10', 'bit_depth': 10, 'size': (1640, 1232), 'fps': 41.85, 'crop_limits': (0, 0, 3280, 2464), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB10_CSI2P, 'unpacked': 'SRGGB10', 'bit_depth': 10, 'size': (1920, 1080), 'fps': 47.57, 'crop_limits': (680, 692, 1920, 1080), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB10_CSI2P, 'unpacked': 'SRGGB10', 'bit_depth': 10, 'size': (3280, 2464), 'fps': 21.19, 'crop_limits': (0, 0, 3280, 2464), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB8, 'unpacked': 'SRGGB8', 'bit_depth': 8, 'size': (640, 480), 'fps': 103.33, 'crop_limits': (1000, 752, 1280, 960), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB8, 'unpacked': 'SRGGB8', 'bit_depth': 8, 'size': (1640, 1232), 'fps': 41.85, 'crop_limits': (0, 0, 3280, 2464), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB8, 'unpacked': 'SRGGB8', 'bit_depth': 8, 'size': (1920, 1080), 'fps': 47.57, 'crop_limits': (680, 692, 1920, 1080), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB8, 'unpacked': 'SRGGB8', 'bit_depth': 8, 'size': (3280, 2464), 'fps': 21.19, 'crop_limits': (0, 0, 3280, 2464), 'exposure_limits': (75, 11766829, None)}]
>>> print(picam2.sensor_modes)
[{'format': SRGGB10_CSI2P, 'unpacked': 'SRGGB10', 'bit_depth': 10, 'size': (640, 480), 'fps': 103.33, 'crop_limits': (1000, 752, 1280, 960), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB10_CSI2P, 'unpacked': 'SRGGB10', 'bit_depth': 10, 'size': (1640, 1232), 'fps': 41.85, 'crop_limits': (0, 0, 3280, 2464), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB10_CSI2P, 'unpacked': 'SRGGB10', 'bit_depth': 10, 'size': (1920, 1080), 'fps': 47.57, 'crop_limits': (680, 692, 1920, 1080), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB10_CSI2P, 'unpacked': 'SRGGB10', 'bit_depth': 10, 'size': (3280, 2464), 'fps': 21.19, 'crop_limits': (0, 0, 3280, 2464), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB8, 'unpacked': 'SRGGB8', 'bit_depth': 8, 'size': (640, 480), 'fps': 103.33, 'crop_limits': (1000, 752, 1280, 960), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB8, 'unpacked': 'SRGGB8', 'bit_depth': 8, 'size': (1640, 1232), 'fps': 41.85, 'crop_limits': (0, 0, 3280, 2464), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB8, 'unpacked': 'SRGGB8', 'bit_depth': 8, 'size': (1920, 1080), 'fps': 47.57, 'crop_limits': (680, 692, 1920, 1080), 'exposure_limits': (75, 11766829, None)}, {'format': SRGGB8, 'unpacked': 'SRGGB8', 'bit_depth': 8, 'size': (3280, 2464), 'fps': 21.19, 'crop_limits': (0, 0, 3280, 2464), 'exposure_limits': (75, 11766829, None)}]
```