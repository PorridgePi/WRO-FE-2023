#include <Common.h>

#define MAX_CORNER_COUNT 12
#define MIN_WALL_DISTANCE 20 // target distance from wall to robot

void loop() {
    start:
        currentCase = 0;
        speed = 0;
        trueAngleZeroTare(trueAngle);

        if (button.isPressed()) {
            delay(100);
            goto initial_lane;
        } else {
            goto start;
        }

    initial_lane:
        currentCase = 1;
        initialDistLeft = distLeft;
        initialDistRight = distRight;
        initialDistFront = distFront;

        speed = SPEED;

        int lidarDiff = distLeftCorr - distRightCorr;
        int wideLane = distLeftCorr + distRightCorr > 60 - LIDAR_FRONT_SPACING + 15;
        if (abs(lidarDiff) > 10) { // not centred
            turn(60 * (lidarDiff > 0 ? -1 : 1), 0, false, 5, 0.2f);
            if (wideLane) moveStraight(10);
            turn(60 * (lidarDiff > 0 ? 1 : -1), 0, false, 5, 0.2f);
        }

        while (abs(lidarDiff) < WALL_MISSING_DISTANCE) { // move straight until wall missing
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
            // faceStraight(0.5f);
            // for (int i = 0; i < 300; i++) {
            //     speed = 0;
            //     digitalWrite(PIN_LED, HIGH);
            //     delay(10);
            // }
            speed = 0;
            delay(500);
            while (distFrontCorr - initialOuterDist > TURNING_RADIUS) { // last corner - move straight until align
                
                correctToRelativeZero();
                speed = 0.5 * SPEED; 
            }
            speed = SPEED;
        }


        // BEFORE TURN

        currentSide = POS_MOD(currentSide + (isClockwise ? 1 : -1), 4); 
        turn(currentSide * 90, isClockwise ? 1 : -1, true);

        while (abs(headingDiff) > 45 || innerDist > 100 || innerDistBack > 100) { // move straight until wall detected
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
        // faceStraight();

        float initialDistance = encoderDistance;
        float targetDistance = distFront - initialDistFront;
        while (distFrontCorr - initialDistFront > 5) {
            digitalWrite(PIN_LED, HIGH);

            // correctToWall(initialInnerDist > 5 ? initialInnerDist : 5);
            correctToRelativeZero();
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
