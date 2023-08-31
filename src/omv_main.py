# Multi Color Blob Tracking Example
#
# This example shows off multi color blob tracking using the OpenMV Cam.
import sensor, image, time, math, pyb, struct
from pyb import UART
uart = UART(1, 9600)
# Color Tracking Thresholds (L Min, L Max, A Min, A Max, B Min, B Max)
# The below thresholds track in general red/green things. You may wish to tune them...
redThreshold = [(25, 55, 13, 65, -3, 34)]
greenThreshold = [(0, 100, -128, -24, -20, 48)]
# You may pass up to 16 thresholds above. However, it's not really possible to segment any
# scene with 16 thresholds before color thresholds start to overlap heavily.
EDGE_THRESHOLD = 80
TURN_TRIGGER_DISTANCE = 130
OFFSET_MULTIPLIER = 0.4

sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QVGA)
sensor.skip_frames(time = 2000)
sensor.set_auto_gain(False) # must be turned off for color tracking
sensor.set_auto_whitebal(False) # must be turned off for color tracking
sensor.set_vflip(True)
pyb.LED(1).on()
pyb.LED(2).on()
pyb.LED(3).on()
clock = time.clock()

# Only blobs that with more pixels than "pixel_threshold" and more area than "area_threshold" are
# returned by "find_blobs" below. Change "pixels_threshold" and "area_threshold" if you change the
# camera resolution. Don't set "merge=True" becuase that will merge blobs which we don't want here.


while(True):
    clock.tick()
    img = sensor.snapshot()
    img.lens_corr(1.65)
    redBlobs = []
    greenBlobs = []
    closestBlobIsRed = True
    width = img.width()
    height = img.height()
    closestBlob = [int(width/2),0]

    for blob in img.find_blobs(redThreshold, pixels_threshold=200, area_threshold=200):
        if blob.cy() > closestBlob[1]:
            closestBlob = [blob[5], blob[6]]

    for blob in img.find_blobs(greenThreshold, pixels_threshold=200, area_threshold=200):
        if blob.cy() > closestBlob[1]:
            closestBlob = [blob[5], blob[6]]
            closestBlobIsRed = False

#    img.binary(redThreshold)
#    for l in img.find_lines(threshold = 10000, theta_margin = 10, rho_margin = 10):
##        if (0 <= l.theta()) and (l.theta() <= 179):
#        img.draw_line(l.line(), color = (255, 0, 0))
#            # print(l)

#    offset = (-1 if closestBlobIsRed else 1) * OFFSET_MULTIPLIER * closestBlob[1]
    print(closestBlob)
    if (closestBlob[0] < EDGE_THRESHOLD or closestBlob[0] > width-EDGE_THRESHOLD) :

        if closestBlob[1] > TURN_TRIGGER_DISTANCE:
            command = 0b00000000
            if closestBlobIsRed:
                command | 0b00000001
            if closestBlob[0] < 0.5 * width:
                command | 0b00000010
            print(command)
            uart.write(bin(command))


    img.draw_line(EDGE_THRESHOLD, 0, EDGE_THRESHOLD, height)
    img.draw_line(width - EDGE_THRESHOLD, 0, width - EDGE_THRESHOLD, height)
    img.draw_line(0, TURN_TRIGGER_DISTANCE, width, TURN_TRIGGER_DISTANCE)
    img.draw_cross(closestBlob[0], closestBlob[1])
    #img.draw_arrow(int(width/2), closestBlob[1],closestBlob[0] + offset , closestBlob[1])

#    deviation = (closestBlob[0] + offset)/width
#    deviation = max(0, min(1, deviation))
    #converting to a 8 bit value
#    print(struct.pack("<B", int(deviation * 255)))
    #uart.write(bin(deviation))
    if uart.any():
        print(uart.read())


