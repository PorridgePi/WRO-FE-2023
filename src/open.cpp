#include <Common.h>

#define MAX_CORNER_COUNT 12


void loop() {
    update();

    speed = SPEED;

    switch (caseMain) {
        case 0: { // stop
            speed = 0;
            turnRatio = 0;
            cornerCount = 0;
            currentSide = 0;
            if (button.isPressed()) {
                trueAngleZeroTare();
                initialDistFront = distFront;
                initialDistLeft = distLeft;
                initialDistRight = distRight;

                caseMain = 1;
            }
            break;
        } case 1: { // first straight lane
            speed = 0;

            static int case1 = -1;
            DPRINT(case1);
            switch (case1) {
                case -1: { // determine case
                    int lidarDiff = distLeftCorr - distRightCorr;
                    if (distLeftCorr + distRightCorr <= 60 - LIDAR_FRONT_SPACING + 15) { // NARROW LANE
                        // NARROW LANE
                        if (abs(lidarDiff) < 10) { // centred
                            EPRINT("NARROW CENTRE ZONE");
                            case1 = 0;
                        } else if (lidarDiff > 0) { // right is closer
                            EPRINT("NARROW RIGHT ZONE"); // narrow left turn
                            case1 = 100;
                        } else { // left is closer
                            EPRINT("NARROW LEFT ZONE"); // narrow right turn
                            case1 = 110;
                        }
                    } else { // WIDE LANE
                        if (abs(lidarDiff) < 10) { // centred
                            EPRINT("WIDE CENTRE ZONE");
                            case1 = 0;
                        } else if (lidarDiff > 0) { // right is closer
                            EPRINT("WIDE RIGHT ZONE"); // wide left turn
                            case1 = 200;
                        } else { // left is closer
                            EPRINT("WIDE LEFT ZONE"); // wide right turn
                            case1 = 210;
                        }
                    }
                    break;
                } case 0: { // move straight until wall
                    speed = SPEED;
                    correctToRelativeZero();
                    bool toTurnRight = distRightCorr - distLeftCorr > WALL_MISSING_DISTANCE; // left is closer, turn right
                    bool toTurnLeft = distLeftCorr - distRightCorr > WALL_MISSING_DISTANCE; // right is closer, turn left
                    if (toTurnLeft || toTurnRight) {
                        isClockwise = toTurnRight && !toTurnLeft; 
                        case1 = -1;
                        caseMain = 2;
                        moveStraight(10);
                    }
                    break;
                } case 100: { // narrow left turn
                    speed = SPEED;
                    turn(-60);
                    turn(60);
                    case1 = 0;
                    break;
                } case 110: { // narrow right turn
                    speed = SPEED;
                    turn(60);
                    turn(-60);
                    case1 = 0;
                    break;
                } case 200: { // wide left turn
                    speed = SPEED;
                    turn(-60);
                    moveStraight(10);
                    turn(60);
                    case1 = 0;
                    break;
                } case 210: { // wide right turn
                    speed = SPEED;
                    turn(60);
                    moveStraight(10);
                    turn(-60);
                    case1 = 0;
                    break;
                }
            }

            break;
        } case 2: { // corner turn
            static int case2 = -1;
            switch (case2) {
                case -1: { // initiate turn
                    cornerCount++;
                    currentSide = POS_MOD(currentSide + (isClockwise ? 1 : -1), 4);
                    turn(currentSide * 90 - trueAngle, isClockwise ? 1 : -1);
                    case2 = 0;
                    break;
                } case 0: { // move straight until wall detected
                    if (abs(headingDiff) < 45 && innerDist < 70 && innerDistBack < 70) { // wall detected, change state // min to prevent false positive
                        case2 = -1; // reset case2
                        if (cornerCount >= MAX_CORNER_COUNT) {
                            caseMain = 4; // END
                        } else {
                            caseMain = 3; // next caseMain
                        }
                    } else {
                        speed = SPEED;
                        correctToRelativeZero();
                    }
                    break;
                }
            }
            break;
        } case 3: { // track along inner wall until corner
            const int MIN_WALL_DISTANCE = 20; // target distance from wall to robot

            static int case3 = -1;
            switch (case3) {
                case -1: { // ran once
                    case3 = 0;
                    break;
                } case 0: {
                    EPRINT(headingDiff)
                    EPRINT(innerDist);
                    EPRINT("CASE3")

                    if (headingDiff > 45) { // wall missing, change state
                        if (cornerCount < MAX_CORNER_COUNT - 1) { // if not reaching last corner
                            moveStraight(10, true);
                        } else { // last corner - move straight until allign
                            float initialDistOuter = isClockwise ? initialDistLeft : initialDistRight;
                            while (distFront - initialDistOuter > TURNING_RADIUS) {
                                update();
                                speed = SPEED;
                                turnRatio = 0;
                            }
                        }
                        while (abs(ANGLE_360_TO_180(relativeAngle)) > 3) { // face straight before turning
                            update();
                            correctToRelativeZero();
                            digitalWrite(PIN_LED, HIGH);
                        }

                        case3 = -1; // reset case3
                        caseMain = 2; // next caseMain
                    } else { // wall present
                        if (abs(innerDistCorr - MIN_WALL_DISTANCE) <= 3) { // move straight
                            correctToRelativeZero();
                            EPRINT("move straight");
                        } else { // correct to wall
                            speed = SPEED;

                            int distDiff = innerDistCorr - MIN_WALL_DISTANCE;
                            // -ve -> too close to inner wall (right wall if clockwise, left wall if anticlockwise)
                            // -> turn left if clockwise, turn right if anticlockwise
                            // -ve if clockwise, +ve if anticlockwise
                            // * 1 if clockwise, * -1 if anticlockwise 
                            float error = constrain(distDiff / 20.0f, -1, 1);
                            turnRatio = powf(abs(error), 1.0f) * (error > 0 ? 1 : -1);
                            turnRatio *= (isClockwise ? 1 : -1); // clockwise -> turn right, anticlockwise -> turn left

                            static float MAX_ANGLE = 30;
                            float tempRelativeAngle = ANGLE_360_TO_180(relativeAngle);
                            if (tempRelativeAngle / turnRatio > 0) { // if they have the same sign, restrict turning
                                float turnRatioMaxMultiplier = constrain((MAX_ANGLE - abs(ANGLE_360_TO_180(relativeAngle))) / MAX_ANGLE, 0, 1);
                                turnRatio *= turnRatioMaxMultiplier;
                            }
                        }
                    }
                    break;
                }
            }
            
            break;
        } case 4: { // return to home section
            static int case4 = -1;
            switch (case4) {
                case -1: {
                    float initialDistance = encoderDistance;
                    while (abs(ANGLE_360_TO_180(relativeAngle)) > 3) { // face straight before continuing
                        update();
                        correctToRelativeZero();
                        digitalWrite(PIN_LED, HIGH);
                    }
                    float targetDistance = distFront - initialDistFront;
                    while (distFrontCorr - initialDistFront > 5 || encoderDistance - initialDistance < targetDistance - 30) {
                        EPRINT(distFront - initialDistFront)
                        EPRINT("AAAAAA")
                        float initialDistOuter = isClockwise ? initialDistLeft : initialDistRight;
                        float initialDistInner = isClockwise ? initialDistRight : initialDistLeft;
                        float MIN_WALL_DISTANCE = initialDistInner;
                        update();
                        speed = SPEED;

                        int distDiff = innerDistCorr - MIN_WALL_DISTANCE;
                        // -ve -> too close to inner wall (right wall if clockwise, left wall if anticlockwise)
                        // -> turn left if clockwise, turn right if anticlockwise
                        // -ve if clockwise, +ve if anticlockwise
                        // * 1 if clockwise, * -1 if anticlockwise 
                        float error = constrain(distDiff / 20.0f, -1, 1);
                        turnRatio = powf(abs(error), 1.0f) * (error > 0 ? 1 : -1);
                        turnRatio *= (isClockwise ? 1 : -1); // clockwise -> turn right, anticlockwise -> turn left

                        static float MAX_ANGLE = 10;
                        float tempRelativeAngle = ANGLE_360_TO_180(relativeAngle);
                        if (tempRelativeAngle / turnRatio > 0) { // if they have the same sign, restrict turning
                            float turnRatioMaxMultiplier = constrain((MAX_ANGLE - abs(ANGLE_360_TO_180(relativeAngle))) / MAX_ANGLE, 0, 1);
                            turnRatio *= turnRatioMaxMultiplier;
                        }
                    }
                    case4 = 0;
                    break;
                } case 0: {
                    case4 = -1;
                    caseMain = 0;
                    break;
                }
            }
        }
    }

    if (button.isPressed() && caseMain != 0) {
        caseMain = 0;
    }

    // DPRINT(isClockwise);
    DPRINT(caseMain);
    DPRINT(currentSide);

    DPRINT(distFront);
    // DPRINT(distFrontCorr);
    DPRINT(distLeft);
    // DPRINT(distLeftCorr);
    DPRINT(distRight);
    // DPRINT(distRightCorr);
    // DPRINT(distLeftBack);
    // DPRINT(distLeftBackCorr);
    // DPRINT(distRightBack);
    // DPRINT(distRightBackCorr);

    DPRINT(trueAngle);
    DPRINT(relativeAngle);
    // DPRINT(speed);
    DPRINT(turnRatio);

    // DPRINT(encoderDistance);
    Serial.println();
}
