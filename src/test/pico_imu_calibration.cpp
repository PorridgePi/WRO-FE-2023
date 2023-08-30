#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <MechaQMC5883.h>
#include <Wire.h>

// Use in combination with https://www.desmos.com/calculator/jvlm9fmemt

// MechaQMC5883 imu(Wire, -28, 46.5, 1.35667791828, -89.8894438815);
MechaQMC5883 imu(Wire, 0, 0, 0, 0);

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
}

void loop() {
    imu.printRaw();
    // Serial.println(imu.readAngle());
    delay(10);
}

void loop1() {
    blinkLED();
}
