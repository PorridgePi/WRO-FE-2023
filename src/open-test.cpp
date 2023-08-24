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
float currentAngle = 0;
int currentCase = 0;
int encoderCount = 0;
float encoderDistance = 0;
float compassZero = 0;
float distLeft = 0, distRight = 0, distFront = 0;
float distLeftCorr = 0, distRightCorr = 0, distFrontCorr = 0;
volatile int ticks = 0;

void checkEncoder() {
  if (digitalRead(PIN_ENCODER_A) == digitalRead(PIN_ENCODER_B)) {
    ticks++;
  } else {
    ticks--;
  }
}

void compassTare(float diff = 0) {
    compassZero = LIM_ANGLE(imu.readAngle() + diff);
}


bool turn(float angle) {
    static float targetAngle = -1;
    if (targetAngle == -1) {
        targetAngle = LIM_ANGLE(currentAngle + angle);
    }

    float angleDiff = DELTA_ANGLE(currentAngle, targetAngle);

    DPRINT(angleDiff);
    DPRINT(targetAngle);
    // DPRINT(turnRatio);

    if (abs(angleDiff) > 3) {
        turnRatio = -1 * constrain(angleDiff / 30, -1, 1);
        speed = SPEED;
        return false;
    } else {
        targetAngle = -1;
        turnRatio = 0;
        speed = SPEED;
        return true;
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

void update() {
    encoderCount = ticks * -1 * DIRECTION;
    encoderDistance = encoderCount / 4.0f / 360.0f * PI * WHEEL_DIAMETER;
    currentAngle = LIM_ANGLE(imu.readAngle() - compassZero);
    distLeft = lidarLeft.read();
    distRight = lidarRight.read();
    distFront = lidarFront.read();
    distLeftCorr = distLeft * cos(RAD(ANGLE_360_TO_180(currentAngle)));
    distRightCorr = distRight * cos(RAD(ANGLE_360_TO_180(currentAngle)));
    distFrontCorr = distFront * sin(RAD(ANGLE_360_TO_180(currentAngle)));
}

void setup() {
    setupComponents();
    Serial.begin(115200);
}

void loop() {
    update();

    static int newCurrentCase = 0;
    int MIN_DISTANCE = 10;
    static int roundCount = 0;
    static bool isUsingLeft = true;
    static bool hasReachedOrigin = true;
    static float currentAngleDirCorrected = 0;
    static long lastButtonPressMillis = millis();
    currentAngleDirCorrected = isUsingLeft ? 360 - currentAngle : currentAngle;

    if (newCurrentCase == 0) {
        speed = 0;
        turnRatio = 0;
        roundCount = 0;

        if (button.isPressed() && millis() - lastButtonPressMillis > 500) {
            compassTare();
            newCurrentCase = 1;
            lastButtonPressMillis = millis();
        }
    } else {
        speed = SPEED;

        turnRatio = constrain((MIN_DISTANCE - distLeft) / 10.0f, -1, 1);
        float currentAngleWRTSide = fmod(currentAngleDirCorrected, 90);
        currentAngleWRTSide = currentAngleWRTSide > 45 ? currentAngleWRTSide - 90 : currentAngleWRTSide;
        int MAX_TURN_ANGLE = 40; // less than 45
        turnRatio *= (MAX_TURN_ANGLE - min(abs(currentAngleWRTSide), MAX_TURN_ANGLE)) / MAX_TURN_ANGLE;

        if (button.isPressed() && millis() - lastButtonPressMillis > 500) {
            newCurrentCase = 0;
            lastButtonPressMillis = millis();

        }

        // if (isUsingLeft) {
        //     turnRatio = -1 * constrain((distLeftCorr - MIN_DISTANCE) / 5.0f, -1, 1);
        // }

        // if (hasReachedOrigin && currentAngleDirCorrected > 30 && currentAngleDirCorrected < 180) {
        //     hasReachedOrigin = false;
        // }

        // if (hasReachedOrigin == false && abs(ANGLE_360_TO_180(currentAngleDirCorrected)) < 3) {
        //     hasReachedOrigin = true;
        //     roundCount++;
        //     if (roundCount == 3) {
        //         newCurrentCase = 0;
        //     }
        // }
    }

    // EPRINT(imu.readAngle());

    // DPRINT(currentCase);
    DPRINT(newCurrentCase);
    DPRINT(roundCount);

    // DPRINT(distFront);
    // DPRINT(distFrontCorr);
    DPRINT(distLeft);
    // DPRINT(distLeftCorr);
    DPRINT(distRight);
    // DPRINT(distRightCorr);

    DPRINT(currentAngle);
    // DPRINT(speed);
    DPRINT(turnRatio);

    // DPRINT(encoderCount);
    DPRINT(encoderDistance);

    Serial.println();

    servo.turn(turnRatio * DIRECTION);
    motor.setSpeed(speed * DIRECTION);
}

void loop1() {
  blinkLED();
}
