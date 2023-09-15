#include <Common.h>

#define SPEED 0.5
#define MIN_TURN_RATIO 0.2f
#define MAX_CORNER_COUNT 12
#define TURN_ANGLE 70
#define MOVE_DISTANCE 15
#define TURNING_RADIUS 15
#define ROBOT_WIDTH 20
// #define MIN_ERROR 1
#define MIN_WALL_DISTANCE 43
#define MIN_ERROR 1
#define MIN_RESPONSE_ANGLE 30
#define POWER 0.4

void changeL(bool isLeft = true) {
    int dir = isLeft ? -1 : 1;

    turn2(currentSide * 90 + TURN_ANGLE * dir, 0, true, MIN_ERROR, MIN_TURN_RATIO, SPEED, MIN_RESPONSE_ANGLE, POWER);
    // moveStraight(5);
    turn2(currentSide * 90 , 0, true, MIN_ERROR, MIN_TURN_RATIO, SPEED, MIN_RESPONSE_ANGLE, POWER); // face straight
    moveStraight(5, true);
    turn2(currentSide * 90 - TURN_ANGLE * dir, 0, true, MIN_ERROR, MIN_TURN_RATIO, SPEED, MIN_RESPONSE_ANGLE, POWER);
    // moveStraight(5);
    turn2(currentSide * 90, 0, true, MIN_ERROR, MIN_TURN_RATIO, SPEED, MIN_RESPONSE_ANGLE, POWER); // face straight
}

void loop() {
    start:
        speed = 0;
        turnRatio = 0;
        currentCase = 0;
        if (button.isPressed()) {
            trueAngleZeroError = 0;
            delay(100);
            trueAngleZeroTare(trueAngle);
            
            // FOR DEBUG/TUNING
            // turn2(90, 0, true, MIN_ERROR, MIN_TURN_RATIO, SPEED, MIN_RESPONSE_ANGLE, POWER); // face straight
            // changeL(false);
            // return;
            
            goto initial_lane;
        } else {
            goto start;
        }

    initial_lane: // first straight lane - 2 possibilities: no block, turn immediately, or with block, avoid and turn after block
        currentCase = 1;

        trueAngleZeroTare(trueAngle);
        initialDistLeft = distLeft;
        initialDistRight = distRight;
        initialDistFront = distFront;

        speed = SPEED;

        justTurned = true;

        goto move_straight;

    corner_turn:
        currentCase = 2;

        if (cornerCount == 0) {
            isClockwise = distLeftCorr - distRightCorr < 0;
            initialInnerDist = isClockwise ? initialDistRight : initialDistLeft;
            initialOuterDist = isClockwise ? initialDistLeft : initialDistRight;
        }
        
        cornerCount++;

        while (distFront > 20 + TURNING_RADIUS) {
            correctToRelativeZero();
        }

        // faceStraight();

        currentSide = POS_MOD(currentSide + (isClockwise ? 1 : -1), 4);
        turn2(currentSide * 90, isClockwise ? -1 : 1, true, MIN_ERROR, MIN_TURN_RATIO, SPEED, MIN_RESPONSE_ANGLE, POWER);

        // goto start;

        // if (cornerCount >= MAX_CORNER_COUNT) {
        //     goto finish; // END
        // } else {
        //     justTurned = true;
        //     goto move_straight; // wall detected, change state
        // }

        justTurned = true;
        goto move_straight;

    move_straight:
        currentCase = 3;

        if (justTurned) {
            justTurned = false;
            while (abs(headingDiff) > 45 || innerDist > 100 || innerDistBack > 100) { // move straight until wall detected
                correctToRelativeZero();

                if (isCameraPresent) {
                    goto avoid_block;
                }
            }
        }

        while (headingDiff < 45) { // wall track until corner or block 
            if (cornerCount >= MAX_CORNER_COUNT) {
                float initialDistance = encoderDistance;
                float targetDistance = distFront - initialDistFront;
                if (distFrontCorr - initialDistFront < 5 && (encoderDistance - initialDistance) > targetDistance) break;
            }

            if (cornerCount == 0) { // first lane, dunno clockwise or anticlockwise
                if (abs(distLeft - distRight) > 100) break;
            } else {
                if (innerDist > 100) break;
            }
            EPRINT(headingDiff)
            EPRINT(innerDist)

            if (isCameraPresent) {
                goto avoid_block;
            }

            if (abs(innerDistCorr - MIN_WALL_DISTANCE) <= 3) { // move straight
                correctToRelativeZero();
            } else {
                float distToCorrectTo = (outerDistCorr + outerDistBackCorr) / 2;
                // correctToWall(MIN_WALL_DISTANCE, 30, distToCorrectTo);
                correctToWall(MIN_WALL_DISTANCE, 30);
            }
            // correctToRelativeZero();
        }

        if (cornerCount >= MAX_CORNER_COUNT) {
            goto finish; // END
        } else {
            goto corner_turn; // wall missing, change state
        }

        // goto corner_turn; // wall missing, change state

    avoid_block:
        currentCase = 4;

        if (isBlockRed) {
            changeL(false);
            // changeL(true);
        } else {
            changeL(true);
            // changeL(false);
        }
        goto move_straight;

    finish:
        currentCase = 5;

        // faceStraight();

        // while (abs(headingDiff) > 45 || innerDist > 100 || innerDistBack > 100) { // move straight until wall detected
        //     correctToRelativeZero();
        // }

        // float initialDistance = encoderDistance;
        // float targetDistance = distFront - initialDistFront;
        // while (distFrontCorr - initialDistFront > 5 || encoderDistance - initialDistance < targetDistance - 5) {
        //     correctToWall(initialInnerDist);
        // }

        // reset variables
        speed = 0;
        turnRatio = 0;
        cornerCount = 0;
        currentSide = 0;
        trueAngleZeroError = 0; // hacks :D - trueAngleTare relies on trueAngle instead of imu.readAngle (cannot be used on main core)
        isClockwise = false;

        goto start;
}
