#include <Common.h>

#define MAX_CORNER_COUNT 12
#define MIN_WALL_DISTANCE 20 // target distance from wall to robot

void loop() {
    start:
        if (button.isPressed()) {
            goto initial_lane;
        } else {
            goto start;
        }

    initial_lane:
        trueAngleZeroTare(trueAngle);
        initialDistLeft = distLeft;
        initialDistRight = distRight;
        initialDistFront = distFront;

        speed = SPEED;

        int lidarDiff = distLeftCorr - distRightCorr;
        int wideLane = distLeftCorr + distRightCorr > 60 - LIDAR_FRONT_SPACING + 15;
        if (abs(lidarDiff) > 10) { // not centred
            turn(60 * (lidarDiff > 0 ? -1 : 1));
            if (wideLane) moveStraight(10);
            turn(60 * (lidarDiff > 0 ? 1 : -1));
        }

        while (abs(lidarDiff) < WALL_MISSING_DISTANCE) { // move straight until wall
            correctToRelativeZero();
            lidarDiff = distLeftCorr - distRightCorr;
        }

        isClockwise = lidarDiff < 0;

        initialInnerDist = isClockwise ? initialDistRight : initialDistLeft;
        initialOuterDist = isClockwise ? initialDistLeft : initialDistRight;

        goto corner_turn;

    corner_turn:
        cornerCount++;
        if (cornerCount < MAX_CORNER_COUNT) {
            moveStraight(10, true); // if not reaching last corner
        } else {
            while (distFront - initialOuterDist > TURNING_RADIUS) { // last corner - move straight until align
                correctToRelativeZero();
            }
        }

        faceStraight();

        currentSide = POS_MOD(currentSide + (isClockwise ? 1 : -1), 4);
        turn(currentSide * 90, isClockwise ? 1 : -1, true);

        while (abs(headingDiff) > 45 || innerDist > 70 || innerDistBack > 70) { // move straight until wall detected
            correctToRelativeZero();
        }

        if (cornerCount >= MAX_CORNER_COUNT) {
            goto finish; // END
        } else {
            goto move_straight; // wall detected, change state
        }

    move_straight:
        while (headingDiff < 45) {
            EPRINT(headingDiff)
            EPRINT(innerDist)

            if (abs(innerDistCorr - MIN_WALL_DISTANCE) <= 3) { // move straight
                correctToRelativeZero();
            } else {
                correctToWall(MIN_WALL_DISTANCE);
            }
        }

        goto corner_turn; // wall missing, change state

    finish:
        faceStraight();

        float initialDistance = encoderDistance;
        float targetDistance = distFront - initialDistFront;
        while (distFrontCorr - initialDistFront > 5 || encoderDistance - initialDistance < targetDistance - 30) {
            correctToWall(initialInnerDist);
        }

        // reset variables
        speed = 0;
        turnRatio = 0;
        cornerCount = 0;
        currentSide = 0;
        trueAngleZeroError = 0; // hacks :D
        isClockwise = false;

        goto start;
}
