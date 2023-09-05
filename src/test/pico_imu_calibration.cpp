#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <MechaQMC5883.h>
#include <Wire.h>

// Use in combination with https://www.desmos.com/calculator/jvlm9fmemt

MechaQMC5883 imu(Wire, 121, 68, 1.2336059744, 88.6456235557);
// MechaQMC5883 imu(Wire, 0, 0, 0, 0);
MechaQMC5883 imu1(Wire1, -96, -221, 1.95970583558, 48.003770227);
// MechaQMC5883 imu1(Wire1, 0, 0, 0, 0);


void setup() {
    Serial.begin(9600);

    Wire.setSCL(PIN_WIRE0_SCL);
    Wire.setSDA(PIN_WIRE0_SDA);
    Wire.setTimeout(1); // set timeout to 1 ms
    Wire.begin();
    Wire1.setSCL(PIN_WIRE1_SCL);
    Wire1.setSDA(PIN_WIRE1_SDA);
    Wire1.setTimeout(1); // set timeout to 1 ms
    Wire1.begin();
    
    imu.init();
    imu.tare();
    imu1.init();
    imu1.tare();
}

void loop() {
    imu.printRaw();
    // imu1.printRaw();
    // Serial.println(imu.readAngle());
    delay(10);
}

void loop1() {
    blinkLED();
}
