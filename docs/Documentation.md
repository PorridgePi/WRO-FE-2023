1. Mobility Management
	1. Motor used for propulsion was the GM25-12CPR. It had a relatively low stall current of 2A, which allowed us to use a smaller motor driver and design the PCB for a lower current.
	2. It was mounted to the vehicle using the included metal bracket, and placed lower down, along with other heavy components, to improve stability.
	3. The gearbox attached to the motor was mounted inline with the motor which reduced the vertical space taken up by the motor, at the expense of restricting the possible orientations in can be mounted. **INSERT PICTURE OF MOTOR IN MOUNT**
	4. The chassis was designed to use articulated steering, which allowed for larger steering angles while keeping the steering mechanism relatively simple. ***PICTURE OF ARTICULATED VS NORMAL STEERING***
	5. The vehicle has single servo rotating the steering axle through a single shaft, as opposed to more conventional steering geometries with multiple linkages and pivots, cutting down on complexity.
	6. The steering axle was designed to be as close as possible to the drive axle to minimise the turning radius, while allowing sufficient space for the steering wheels to rotate freely.
 		- ![](../attachments/Pasted%20image%2020230824165650.png)

	8. Given that $\text{Turn radius} \approx D\tan({90\degree-\theta\degree})$, where $D$ is the distance between the steering and driving axle, and $\theta$ is the steering angle, minimising $D$ would be ideal. ***INSERT PICTURE OF ACKERMANN STEERING CRAP***
	9. The baseplate, upper plate, and PCB were designed to be connected via M3 standoffs, which allowed for flexibility in adjusting the height, and made swapping components easier.
2. Power and Sense
	1. The vehicle is powered off a single 3-cell Lithium Polymer (LiPo) battery, which allows for high peak current draw in excess of 10A and is easy to design around, given its rectangular shape.
	2. Power passes through a 5V regulator before being distributed to the servo, sensors and Raspberry Pi Pico used as a microcontroller.
	3. Front and side facing LiDARs are used to measure the distance to the walls. The TFLunas used have a maximum range of 2m which is sufficient for detecting the side walls but may at times not have enough 
3. 
	
