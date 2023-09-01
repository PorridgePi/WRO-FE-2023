1. Mobility Management
    1. Motor used for propulsion was the GM25-12CPR. It had a relatively low stall current of 2A, which allowed us to use a smaller motor driver and design the PCB for a lower current.
    2. It was mounted to the vehicle using the included metal bracket, and placed lower down, along with other heavy components, to improve stability.
    3. The gearbox attached to the motor was mounted inline with the motor which reduced the vertical space taken up by the motor, at the expense of restricting the possible orientations in can be mounted. **INSERT PICTURE OF MOTOR IN MOUNT**
    4. The chassis was designed to use articulated steering, which allowed for larger steering angles while keeping the steering mechanism relatively simple. ![[../attachments/Pasted image 20230829184541.png]]
    5. The vehicle has a single servo rotating the steering axle through a single shaft, as opposed to more conventional steering geometries with multiple linkages and pivots, cutting down on complexity.
    6. The steering axle was designed to be as close as possible to the drive axle to minimise the turning radius, while allowing sufficient space for the steering wheels to rotate freely.
       ![../attachments/Pasted image 20230824165650.png](../attachments/Pasted%20image%2020230824165650.png)
    7. Given that $\text{Turn radius} \approx D\tan({90\degree-\theta\degree})$, where $D$ is the distance between the steering and driving axle, and $\theta$ is the steering angle, minimising $D$ would be ideal. ![[../attachments/Pasted image 20230829184645.png]]
    8. 
    9. The baseplate, upper plate, and PCB were designed to be connected via M3 standoffs, which allowed for flexibility in adjusting the height, and made swapping components easier.
2. Power and Sense
    1. The vehicle is powered off a single 3-cell Lithium Polymer (LiPo) battery, which allows for high peak current draw in excess of 10A and is easy to design around, given its rectangular shape.
    2. Power passes through a 5V regulator before being distributed to the servo, sensors and Raspberry Pi Pico used as a microcontroller.
    3. Front and side facing LiDARs are used to measure the distance to the walls. The TFLunas used have a maximum range of 2m which is sufficient for detecting the side walls but may at times not have enough especially for the front facing LiDAR.
    4. Block detection is done through an OpenMV M7 mounted on the front of the vehicle. It is quite easy to interface with and was easy to use, given the libraries provided with the OpenMV IDE.
    5. We were initially considering using a Raspberry Pi Camera Module but decided against it as it had issues with latency.
3. Obstacle management
    1. For the open round, the vehicle attempts to maintain a fixed distance from the inner wall. 2 LiDARs, mounted at the front and rear of the vehicle, face the inner wall and are used to gauge the vehicle's proximity and angle with respect to the wall. Corners are detected based on the disparity between the 2 LiDAR readings with the LiDARs, with the forward LiDARs detecting the sudden increase in range before the rear LiDARs.
    2. When the vehicle is started, it measures the range to the front and sides to get its start position, which is used to determine its starting section.
    3. For the obstacle round, coloured blocks were detected using the blob identification library that came with the OpenMV software.![[../attachments/Pasted image 20230901130434.png]]
    4. The all the green and red blobs are compared and the block whose centroid lies the lowest in the camera's frame is used as the closest block.
    5. Once the closest block falls below a preset Y threshold, the OpenMV sends a command the the Pico. The Pico then performs 4 turns to evade the block and afterwards, return to the initial path.![[../attachments/Pasted image 20230901131442.png]]
    6. 

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