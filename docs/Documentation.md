# Contents
1. Mobility Management
2. Power and Sense
3. Obstacle Management
4. Code Style Guidelines
5. Schematics and PCB


# Introduction
Team ID: `FE0901`
Team Name: `raffles institution team 3`
Team Members:
- Zhou Yikun
- Zachary Ang

# Hardware
# Bill of Materials (BOM)
| Description       | Brand        | Model                       | Number | Others                                                                            |
| ----------------- | ------------ | --------------------------- | ------ | --------------------------------------------------------------------------------- |
| Motor             | YFROBOT      | GM25-12CPR                  | 1      | Contains Encoder, [Link](https://yfrobot.com/products/metal-gearmotor-ga25-12v-with-16-cpr-encoder) |
| Servo             | Tower-Pro    | MG996R                      | 1      | [Schematics](https://www.electronicoscaldas.com/datasheet/MG996R_Tower-Pro.pdf)   |
| Motor Driver      | -            | AT8236                      | 1      |                                                                                   |
| Microcontroller   | Raspberry Pi | Pico                        | 1      |                                                                                   |
| Voltage Regulator | CKCS         | CKCS-BK-2                   | 1      | 5V4A Output                                                                       |
| LiDAR             | -            | TF-Luna                     | 5      |                                                                                   |
| PCB               | JLCPCB       | -                           | 1      |                                                                                   |
| Camera            | OpenMV       | M7                          | 1      |                                                                                   |
| Compass           | -            | GY-273                      | 1      | Labelled HMC5883L, using QMC5883L                                                 |
| Compass           | -            | GY-271                      | 1      | Uses QMC5883L                                                                     |
| LiPo Battery      | Turnigy      | Nano-tech 1300mAh 3S 45~90C |        |                                                                                   |
|                   |              |                             |        |                                                                                   |

# Power
- 12V LiPo battery powers:
    - Motor driver to supply power to the single motor
    - Voltage regulator that outputs 5V with a maximum sustained current of 4A
- Resultant 5V from voltage regulator powers:
    - Sensors (LiDAR and Compass)
    - Microcontroller (Raspberry Pi Pico)
    - Camera (OpenMV M7)
    - Servo
    - Motor driver signal
    - Encoder on the motor

# Communication
Various sensors, and the camera, communicate with the main microcontroller, Raspberry Pi Pico, via multiple protocols.
Inputs
- LiDAR: I2C
    - Each LiDAR is either set to a different I2C address, or run on a different I2C bus of the Pico
- Camera: UART
- Compass: I2C
    - One compass per I2C bus for failsafe
- Encoder: digital HIGH/LOW signals
Outputs
- Motor driver: PWM signal

# Choice of Components

## Microcontroller

The Raspberry Pi Pico was chosen for various reasons:
- Affordability
    - Pico is extremely affordable, priced at 4.00 USD each, so the overall cost would be reduced especially when more Picos are to be purchased for backup
- Fast processor and Memory
    - Pico has a dual-core Arm Cortex-M0+ processor that runs at 133 Mhz, which is much faster than alternatives like the Arduino Nano (16 Mhz). While it is slower than the Teensy 4.0 which runs at 400 Mhz, it has two cores instead of one, allowing for multicore operations. This is not to ignore the price advantage Pico has over alternatives.
        - With regards to the dual core processor, we actively took advantage of it, by running the movement control code (i.e. movement motor and steering via servo) on the second core while running the main loop gathering and processing data from sensors to make movement decisions on the main core.
- Variety of Protocols and GPIO Pins
    - GPIO pins on the Pico are multi-purpose, and each pin could be used with almost any supported protocol, including 2 x I2C buses, 2 x SPI buses, 2 UART ports, 16 x PWM channels and 3 x analog ports.
        - More interfaces available than alternatives such as the Arduino Nano and 
        - Such a multitude of protocols allow us to connect any peripherals such as sensors we want.
- Compatibility with Arduino
    - We are already familiar with the Arduino ecosystem, so finding a microcontroller that is compatible with Arduino is key
- Size
    - Despite Pico's small size, it still packs in a lot of capabilities

- [YFROBOT 4WD chassis steered by a servo motor – yfrobot](https://yfrobot.com/products/steering-gear-robot)
    - stall current
        - @8.4v - 4A
        - at 12V - 6A
- Motor Driver
    - [SparkFun Motor Driver - Dual TB6612FNG (1A)](https://www.sparkfun.com/products/14451)
- Motor
    - 25GA-12
    - [YFROBOT Metal Gearmotor GA25 12V with 13 CPR Encoder Hall speed measur – yfrobot - https://yfrobot.com/products/metal-gearmotor-ga25-12v-with-16-cpr-encoder](https://yfrobot.com/products/metal-gearmotor-ga25-12v-with-16-cpr-encoder)
    - 25GA-370
        - [Specifications_for_Motor.pdf](https://files.seeedstudio.com/wiki/Skeleton_Bot-4WD_hercules_mobile_robotic_platform/res/Specifications_for_Motor.pdf)
        - [产品型号：GM25-370-24140-75-14.5D10.xls](https://osoyoo.com/picture/mecanum_wheel_robotic/GM25-370-motor%20specification.pdf)
- Servo Motor (for steering)
- LiPo
    - suitable voltage - closest to most common voltage used by components
    - 18650 - 2x3.7V?
    - if really needed - check conversion efficiency of voltage regulator



# 1. Mobility Management
1. Motor used for propulsion was the GM25-12CPR. It had a relatively low stall current of 2A, which allowed us to use a smaller motor driver and design the PCB for a lower current.
2. It was mounted to the vehicle using the included metal bracket, and placed lower down, along with other heavy components, to improve stability.
3. The gearbox attached to the motor was mounted inline with the motor which reduced the vertical space taken up by the motor, at the expense of restricting the possible orientations in can be mounted. **INSERT PICTURE OF MOTOR IN MOUNT**
4. The chassis was designed to use articulated steering, which allowed for larger steering angles while keeping the steering mechanism relatively simple. 
   ![../attachments/Pasted image 20230829184541.png](../attachments/Pasted%20image%2020230829184541.png)
5. The vehicle has a single servo rotating the steering axle through a single shaft, as opposed to more conventional steering geometries with multiple linkages and pivots, cutting down on complexity.
6. The steering axle was designed to be as close as possible to the drive axle to minimise the turning radius, while allowing sufficient space for the steering wheels to rotate freely.
   ![../attachments/Pasted image 20230824165650.png](../attachments/Pasted%20image%2020230824165650.png)
7. Given that $\text{Turn radius} \approx D\tan({90\degree-\theta\degree})$, where $D$ is the distance between the steering and driving axle, and $\theta$ is the steering angle, minimising $D$ would be ideal. ![../attachments/Pasted image 20230829184645.png](../attachments/Pasted%20image%2020230829184645.png)
8. The baseplate, upper plate, and PCB were designed to be connected via M3 standoffs, which allowed for flexibility in adjusting the height, and made swapping components easier.
# 2. Power and Sense
1. The vehicle is powered off a single 3-cell Lithium Polymer (LiPo) battery, which allows for high peak current draw in excess of 10A and is easy to design around, given its rectangular shape.
2. Power passes through a 5V regulator before being distributed to the servo, sensors and Raspberry Pi Pico used as a microcontroller.
3. Front and side facing LiDARs are used to measure the distance to the walls. The TFLunas used have a maximum range of 2m which is sufficient for detecting the side walls but may at times not have enough especially for the front facing LiDAR.
4. Block detection is done through an OpenMV M7 mounted on the front of the vehicle. It is quite easy to interface with and was easy to use, given the libraries provided with the OpenMV IDE.
5. We were initially considering using a Raspberry Pi Camera Module but decided against it as it had issues with latency.
# 3. Obstacle management
1. For the open round, the vehicle attempts to maintain a fixed distance from the inner wall. 2 LiDARs, mounted at the front and rear of the vehicle, face the inner wall and are used to gauge the vehicle's proximity and angle with respect to the wall. Corners are detected based on the disparity between the 2 LiDAR readings with the LiDARs, with the forward LiDARs detecting the sudden increase in range before the rear LiDARs.
2. When the vehicle is started, it measures the range to the front and sides to get its start position, which is used to determine its starting section.
3. For the obstacle round, blocks were detected using the blob identification library that came with the OpenMV software.
   ![../attachments/Pasted image 20230901130434.png](../attachments/Pasted%20image%2020230901130434.png)
4. The all the green and red blobs are compared and the block whose centroid lies the lowest in the camera's frame is used as the closest block.
5. Once the closest block falls below a preset Y threshold, the OpenMV sends a command the the Pico. The Pico then performs 4 turns to evade the block and afterwards, return to the initial path.
   ![[../attachments/Pasted image 20230901131442.png]]

# Code Style Guidelines
- Annotate code where possible.
- Delete unused code unless intended for immediate use.
- Avoid long equations, ie. break them down into a few statements.
- Naming:
    - `PascalCase` for class names.
    - `camelCase` for normal variable names.
    - `UPPER_SNAKE_CASE` for definitions.
    - Capitalise acronyms.
- OOP

# Schematics and PCB
![../attachments/Schematics.png](../attachments/Schematics.png)
![../attachments/PCB_Front.png](../attachments/PCB_Front.png)
![../attachments/PCB_Back.png](../attachments/PCB_Front.png)
