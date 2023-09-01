# Autonomous Robot Competition Summary

## Overview

This summary provides an overview of our participation in an autonomous robot competition, including details about our hardware, mobility management strategies, power and sensing systems, obstacle management approach, and code style guidelines. Our team, "raffles institution team 3" (Team ID: FE0901), consisting of Zhou Yikun and Zachary Ang, aimed to create an autonomous robot capable of navigating a complex environment and completing specific challenges.

## Hardware Overview

We carefully selected the components for our robot, ensuring they met the requirements of our competition. Key components included:

- **Motor**: We used the YFROBOT GM25-12CPR motor with an encoder for propulsion.
- **Servo**: The Tower-Pro MG996R servo controlled the steering mechanism.
- **Motor Driver**: The AT8236 motor driver was chosen for its overcurrent protection and suitable current ratings.
- **Microcontroller**: We employed the Raspberry Pi Pico as our primary microcontroller.
- **Voltage Regulator**: The CKCS CKCS-BK-2 voltage regulator provided stable 5V power.
- **LiDAR**: Five TF-Luna LiDAR sensors were used for distance ranging.
- **Camera**: An OpenMV M7 camera facilitated block detection.
- **Compasses**: We integrated GY-273 and GY-271 compass modules for orientation.
- **LiPo Battery**: The Turnigy Nano-tech 1300mAh 3S LiPo battery provided power.

## Mobility Management

### Motor and Steering

Our robot's propulsion system used the GM25-12CPR motor with an AT8236 motor driver. We designed the PCB to allow for combining dual channels to increase current output if necessary. Steering was controlled by a Tower-Pro servo.

### Vehicle Chassis Design

Our chassis featured articulated steering for improved maneuverability. We used M3 standoffs to connect the baseplate, upper plate, and PCB, offering flexibility and ease of component swapping.

## Power and Sensing

### Power

A 12V LiPo battery powered our robot, with a 5V regulator distributing power to various components, including sensors, the microcontroller, camera, servo, and motor driver.

### Sensing

- **LiDAR**: We used LiDAR sensors for distance ranging, selecting them for their accuracy and suitability for our competition field.
- **Camera**: The OpenMV M7 camera handled block detection, offering ease of use and compatibility.
- **Compasses**: We integrated compass modules for orientation.
- **Encoder**: An encoder was employed to monitor motor movement.

## Communication

Our robot's various sensors and the camera communicated with the Raspberry Pi Pico via multiple protocols, including I2C, UART, and digital signals.

## Obstacle Management

### Open Challenge

In the open challenge, our robot aimed to maintain a fixed distance from the inner wall. We used front and rear LiDARs to gauge proximity and angle relative to the wall. Corner detection relied on the disparity between these LiDAR readings.

### Obstacle Challenge

For the obstacle challenge, our robot used an OpenMV camera to detect colored blocks. The closest block was identified based on its centroid's position in the camera's frame. When a block fell below a preset threshold, our robot executed avoidance maneuvers and returned to its original path.

## Code Style Guidelines

Our code adhered to specific style guidelines, including:

- Annotated code where possible.
- Deleted unused code.
- Avoided overly long equations.
- Followed naming conventions such as PascalCase for class names and camelCase for variables.
- Used UPPER_SNAKE_CASE for definitions.
- Capitalized acronyms.
- Embraced object-oriented programming principles.

## Conclusion

Our participation in the autonomous robot competition involved meticulous hardware selection, effective mobility management, robust power and sensing systems, obstacle management strategies, and adherence to coding standards. We tackled complex challenges in an innovative and systematic manner, aiming to excel in the competition.