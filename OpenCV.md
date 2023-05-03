- [[2023-05-03]]
	- with [[Raspberry Pi Camera]]
		- [Optimizing OpenCV on the Raspberry Pi - PyImageSearch](https://pyimagesearch.com/2017/10/09/optimizing-opencv-on-the-raspberry-pi/)
		- [Using the Raspberry Pi Camera on Bullseye OS and OpenCV | Technology Tutorials](https://toptechboy.com/using-the-raspberry-pi-camera-on-bullseye-os-and-opencv/)
			- `pip install opencv-python==4.6.0.66`
		```python
		import cv2
		from picamera2 import Picamera2
		picam2 = Picamera2()
		picam2.preview_configuration.main.size = (1280,720)
		picam2.preview_configuration.main.format = "RGB888"
		picam2.preview_configuration.align()
		picam2.configure("preview")
		picam2.start()
		while True:
		    im= picam2.capture_array()
		    cv2.imshow("Camera", im)
		    if cv2.waitKey(1)==ord('q'):
		        break
		cv2.destroyAllWindows()
		```