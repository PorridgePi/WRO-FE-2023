1. Mobility Management
	1. Motor used for propulsion was the GM25-12CPR. It had a relatively low stall current of 2A, which allowed us to use a smaller motor driver and design the PCB for a lower current.
	   It was mounted to the vehicle with the included metal bracket, and placed lower down, along with other heavy components (, to improve stability.
		1. 
		2. 
		3. Advantages
			1. Came with an encoder with a 1440 BPR resolution, combined with a 1:34 inline gear box, allowed for an actual resolution of 1/136th of a degree.
			2. Low stall current of 2A while providing sufficient maximum RPM and torque.
		4. Implementation
			1. The motor came with a metal bracket which was used to attach it.
			2. Its relatively low profile allowed it to be mounted lower down without taking up too much vertical space to improve stability.
			3. **INSERT PICTURE OF MOTOR IN MOUNT**
		5. The chassis was designed to use articulated steering, which allowed for larger steering angles while keeping the steering mechanism relatively simple. ***PICTURE OF ARTICULATED VS NORMAL STEERING***
		6. The vehicle has single servo rotating the steering axle through a single shaft, as opposed to more conventional steering geometries with multiple linkages and pivots, cutting down on complexity.
		7. The steering axle was designed to be as close as possible to the drive axle to minimise the turning radius, while allowing sufficient space for the steering wheels to rotate freely.
		   Given that $\text{Turn radius} \approx D\tan({90\degree-\theta\degree})$, where $D$ is the distance between the steering and driving axle, and $\theta$ is the steering angle, minimising $D$ would be ideal. ***INSERT PICTURE OF ACKERMANN STEERING CRAP***
		8. The baseplate, upper plate, and PCB were designed to be connected via M3 standoffs, which allowed for flexibility in adjusting the height, and made swapping components easier.
		9. All the heavy components like the motor and battery were mounted as low as possible to improve stability allowing for faster speeds and tighter turning if needed.

3. 
4. 
	