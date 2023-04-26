#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <Button.h>
#include <Motor.h>
#include <DriveServo.h>
#include <MechaQMC5883.h>
#include <Lidar.h>

#define DEBUG_PRINT true
#define DIRECTION -1
#define SPEED 0.3

Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);
DriveServo servo(PIN_SERVO);
MechaQMC5883 imu(Wire, 262.5, 82.5, 1.35437467403, 87.6595133393);
Lidar lidarFront(Wire1, 0x10);
Lidar lidarLeft(Wire1, 0x11);
Lidar lidarRight(Wire, 0x12);

float speed = 0, turnRatio = 0;

int currentCase = 0, turnCase = -1;
int encoderCount = 0;
float encoderDistance = 0;

float distLeft = 0, distRight = 0, distFront = 0;
float distLeftCorr = 0, distRightCorr = 0, distFrontCorr = 0;
volatile int ticks = 0;


int initialDistLeft = 0, initialDistRight = 0, initialDistFront = 0;

float trueAngle = 0, trueAngleZeroError = 0; // relative to the start i.e. 0 <= x < 360
float relativeAngle = 0, relativeAngleZeroError = 0; // relative to each side i.e. 0 <= x < 90

bool isClockwise = true; // clockwise -> turn right, anticlockwise -> turn left

void checkEncoder() {
  if (digitalRead(PIN_ENCODER_A) == digitalRead(PIN_ENCODER_B)) {
    ticks++;
  } else {
    ticks--;
  }
}

void correctToRelativeZero() {
    turnRatio = -1 * constrain(ANGLE_360_TO_180(relativeAngle) / 30, -1, 1);
}

void relativeAngleTare(float diff = 0) {
    relativeAngleZeroError = LIM_ANGLE(imu.readAngle() + diff);
}

void trueAngleZeroTare(float diff = 0) {
    trueAngleZeroError = LIM_ANGLE(imu.readAngle() + diff);
}

void update() {
    encoderCount = ticks * -1 * DIRECTION;
    encoderDistance = encoderCount / 4.0f / 360.0f * PI * WHEEL_DIAMETER;

    float angle = imu.readAngle();
    relativeAngle = LIM_ANGLE(angle - relativeAngleZeroError);
    trueAngle = LIM_ANGLE(angle - trueAngleZeroError);

    distLeft = lidarLeft.read();
    distRight = lidarRight.read();
    distFront = lidarFront.read();
    distLeftCorr = distLeft * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distRightCorr = distRight * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distFrontCorr = distFront * sin(RAD(ANGLE_360_TO_180(relativeAngle)));
}

void turn(float angle) {
    float targetAngle = LIM_ANGLE(imu.readAngle() + angle);
    while (abs(imu.readAngle() - targetAngle) > 1) {
        float currentAngle = imu.readAngle();
        turnRatio = constrain(ANGLE_360_TO_180(DELTA_ANGLE(currentAngle, targetAngle))/30.0f, -1, 1);
        const float minTurnRatio = 0.5;
        if (abs(turnRatio) < minTurnRatio) {
            turnRatio = turnRatio > 0 ? minTurnRatio : -1 * minTurnRatio;
        }
        EPRINT("turning...");
        DPRINT(currentAngle);
        DPRINT(targetAngle);
        EPRINT(DELTA_ANGLE(currentAngle, targetAngle));
        Serial.println();
    }
}

void moveStraight(float distance, float speed = SPEED) {
    update();
    float targetDistance = encoderDistance + distance;
    while (abs(encoderDistance - targetDistance) > 1) {
        update();
        turnRatio = 0;
        speed = SPEED * (encoderDistance < targetDistance ? 1 : -1) * DIRECTION;

        EPRINT("moving...");
        DPRINT(speed);
        DPRINT(encoderDistance);
        DPRINT(targetDistance);
        Serial.println();
    }
}

void setupComponents() {
    // I2C for LiDAR and IMU
    Wire.setSCL(PIN_WIRE0_SCL);
    Wire.setSDA(PIN_WIRE0_SDA);
    Wire.setTimeout(1); // set timeout to 1 ms
    Wire.begin();
    Wire1.setSCL(PIN_WIRE1_SCL);
    Wire1.setSDA(PIN_WIRE1_SDA);
    Wire1.setTimeout(1); // set timeout to 1 ms
    Wire1.begin();

    // Servo
    servo.init();

    // IMU
    imu.init();
    imu.tare();

    // Encoder
    attachInterrupt(digitalPinToInterrupt(PIN_ENCODER_A), checkEncoder, CHANGE);
}

void setup() {
    setupComponents();
    Serial.begin(115200);
}

void loop() {
    update();

    speed = SPEED;
    static int sideCount = 0;

    switch (currentCase) {
        case 0: { // stop
            speed = 0;
            turnRatio = 0;
            sideCount = 0;

            relativeAngleTare();
            if (button.isPressed()) {
                trueAngleZeroTare();
                initialDistFront = distFront;
                initialDistLeft = distLeft;
                initialDistRight = distRight;
                
                turnCase = -1;
                currentCase = 1;
            }
            break;
        } case 1: { // first straight lane
            speed = 0;

            DPRINT(turnCase);
            switch (turnCase) {
                case -1: { // determine case
                    int lidarDiff = distLeftCorr - distRightCorr;
                    if (distLeftCorr + distRightCorr <= 60 - LIDAR_FRONT_SPACING + 15) { // NARROW LANE
                        // NARROW LANE
                        if (abs(lidarDiff) < 10) { // centred
                            EPRINT("NARROW CENTRE ZONE");
                            turnCase = 0;
                        } else if (lidarDiff > 0) { // right is closer
                            EPRINT("NARROW RIGHT ZONE"); // narrow left turn
                            turnCase = 100;
                        } else { // left is closer
                            EPRINT("NARROW LEFT ZONE"); // narrow right turn
                            turnCase = 110;
                        }
                    } else { // WIDE LANE
                        if (abs(lidarDiff) < 10) { // centred
                            EPRINT("WIDE CENTRE ZONE");
                            turnCase = 0;
                        } else if (lidarDiff > 0) { // right is closer
                            EPRINT("WIDE RIGHT ZONE"); // wide left turn
                            turnCase = 200;
                        } else { // left is closer
                            EPRINT("WIDE LEFT ZONE"); // wide right turn
                            turnCase = 210;
                        }
                    }
                    break;
                } case 0: { // move straight until wall
                    speed = SPEED;
                    correctToRelativeZero();

                    if (distRightCorr - distLeftCorr > 100) { // left is closer, turn right
                        isClockwise = true;
                        currentCase = 4;
                        currentCase = 0;
                    } else if (distLeftCorr - distRightCorr > 100) { // right is closer, turn left
                        isClockwise = false;
                        currentCase = 3;
                        currentCase = 0;
                    }
                    break;
                } case 100: { // narrow left turn
                    speed = SPEED;
                    turn(-60);
                    moveStraight(7);
                    turn(60);
                    turnCase = 0;
                    break;
                } case 110: { // narrow right turn
                    speed = SPEED;
                    turn(60);
                    moveStraight(7);
                    turn(-60);
                    turnCase = 0;
                    break;
                } case 200: { // wide left turn
                    speed = SPEED;
                    turn(-60);
                    moveStraight(15);
                    turn(60);
                    turnCase = 0;
                    break;
                } case 210: { // wide right turn
                    speed = SPEED;
                    turn(60);
                    moveStraight(15);
                    turn(-60);
                    turnCase = 0;
                    break;
                }
            }

            break;
        } case 2: { // moving straight
            const int MIN_DISTANCE = 10;
            int innerDist = isClockwise ? distRightCorr : distLeftCorr;


            break;
        } case 3: {
            break;
        } case 4: {
            break;
        }
    }

    if (button.isPressed() && currentCase != 0) {
        currentCase = 0;
    }

    // EPRINT(imu.readAngle());
    DPRINT(currentCase);

    // DPRINT(distFront);
    // DPRINT(distFrontCorr);
    DPRINT(distLeft);
    // DPRINT(distLeftCorr);
    DPRINT(distRight);
    // DPRINT(distRightCorr);

    // DPRINT(trueAngle);
    DPRINT(relativeAngle);
    // DPRINT(speed);
    // DPRINT(turnRatio);

    // DPRINT(encoderCount);
    DPRINT(encoderDistance);

    Serial.println();
}

void loop1() {
    blinkLED();
    servo.turn(turnRatio * DIRECTION);
    motor.setSpeed(speed * DIRECTION);
}
