# Wheels
- Wide v.s. Thin
    - affect surface area in contact with ground, affecting how rubber gets squished
- Size (i.e. diameter) affects
    - size of cavity to allow steering
    - torque
        - larger the diameter, moment of inertia is higher, more torque required
    - distance travelled per revolution
- Mass

# Motor
- Encoder
- Motor Stall Current
    - proportional to Vin
- nominal voltage
- [Pulling power from the balance plug - RC Groups - https://www.rcgroups.com/forums/showthread.php?1442019-Pulling-power-from-the-balance-plug](https://www.rcgroups.com/forums/showthread.php?1442019-Pulling-power-from-the-balance-plug)
# Steering
- Take note of steer radius
    - tightest turn at corners would be less than 40cm (i.e. both blocks require keeping to the left)
    - movement between blocks would be around a maximum turn radius of 50cm
- Servo
    - [Servo - writeMicroseconds() - Arduino Reference - https://reference.arduino.cc/reference/en/libraries/servo/writemicroseconds/](https://reference.arduino.cc/reference/en/libraries/servo/writemicroseconds/)
    - use this instead of `.write()`
- [Servo Motors - Arduino - Wiki.nus - https://wiki.nus.edu.sg/display/Arduino/Servo+Motors](https://wiki.nus.edu.sg/display/Arduino/Servo+Motors)

    - need to take into account the length and width of the vehicle
    - lines from both front wheels and the line through back wheels should all come together at a single point
        - ![](http://datagenetics.com/blog/december12016/ideal3.png)
        - ![Tech Explained: Ackermann Steering Geometry - Racecar Engineering](https://www.racecar-engineering.com/wp-content/uploads/2021/04/Figure-1.jpg)

- Website: [Ackerman Steering](http://datagenetics.com/blog/december12016/index.html)


# Motor Driver
- ???????

# Camera
1. [[Raspberry Pi Camera]] with [[OpenCV]]
2. OpenMV but we no have
3. Pixy

- Dual/Stereo Cameras

# Ranging/Localisation
- LiDAR
- Camera
- Optical Flow

# Orientation
- IMU
- Compass

# Notes
- Ideally only camera for SLAM would yield the smallest robot
