# WRO 2023 Future Engineers

# Team Information

Team ID: `FE0901`

Team Name: `raffles institution team 3`

Team Members
- [Yikun](https://github.com/PorridgePi)
- [Zachary](https://github.com/Zachareeeeee)

# Overview

Welcome to the GitHub repository for Team `FE0901` participating in WRO 2023. In this competition, we are building an autonomous robotic vehicle capable of completing 2 different challenges. This README provides an overview of our project. If you wish to delve deeper into our engineering process, please check out our [Engineering Journal](Engineering%20Journal.md) or [download it as PDF](https://github.com/PorridgePi/WRO-FE-2023/blob/main/docs/Engineering%20Journal.pdf).

# Usage
For Code, Using Visual Studio Code:
- Clone this repository: `git clone https://github.com/PorridgePi/WRO-FE-2023`
- Change directory: `cd ./WRO-FE-2023/`
- Initialise Git submodule(s): `git submodule update --init --recursive`
- Open the repository in VSCode: `code ./`
- Install the PlatformIO plugin
- Use the PlatformIO plugin to compile and upload code onto the microcontroller
- Upload code onto OpenMV using the [OpenMV IDE](https://openmv.io/pages/download)

For Documentation, Using [Obsidian](https://obsidian.md/):
- Clone this repository: `git clone https://github.com/PorridgePi/WRO-FE-2023`
- Open the cloned directory as a Vault

For PCB, Using [KiCAD](https://www.kicad.org/):
- Clone this repository: `git clone https://github.com/PorridgePi/WRO-FE-2023`
- Open the file `schemes/WRO_2023/WRO_2023.kicad_pro`

# Repository Content
- `.github/workflows/platformio-ci.yml`: GitHub Actions CI workflow for PlatformIO ([Documentation](https://docs.platformio.org/en/latest/integration/ci/github-actions.html))
- `.vscode/`: Folder containing VSCode workspace settings
    - `extensions.json`: List of recommended and unwanted extensions ([Documentation](https://code.visualstudio.com/docs/editor/extension-gallery#_workspace-recommended-extensions))
- `models/`: 3D models
- `others/`: Other files
- `schemes/`: Schematic diagram and PCB
    - `WRO_2023`: PCB files that can be opened in KiCAD
- `scripts/`: Scripts for PlatformIO
    - `ci.sh`: Script for CI test
    - `extra_scripts.py`: Extra scripts for PlatformIO (run before and after build - [Documentation](https://docs.platformio.org/en/latest/scripting/actions.html))
- `src/`: Main code
    - `lib/`: Libraries for components
        - Notably:
            - `lib/private/Common.h`: Shared code between `open.cpp` and `obstacle.cpp`
            - `lib/Mecha_QMC5883L`: [Forked version](https://github.com/PorridgePi/Mecha_QMC5883L) of library for the QMC5883L magnetometer
    - `test/`: Test code
    - `main.cpp`: Placeholder file
    - `obstacle.cpp`: Code for the Obstacle Challenge
    - `open.cpp`: Code for the Open Challenge
- `t-photos`: Team photo
- `v-photos`: Photos of the vehicle (from many different angles!)
- `video`: Contains [video.md](video/video.md) with the link to the video of the driving demonstration
- `.clang-format`: ClangFormat code style file - to format code in VSCode
- `.gitignore`: gitignore file ([Documentation](https://git-scm.com/docs/gitignore))
- `platformio.ini`: PlatformIO configuration file ([Documentation](https://docs.platformio.org/en/stable/projectconf/index.html))
- `README.md`: This file

# Reminders before Running
1. Calibrate compass(es)
2. Ensure steering mechanism is tightened
3. Clean wheels to ensure grip

# Hardware used
* **Motor:** 1x GM25-12CPR 
* **Servo:** 1x MG996R
* **Motor Driver:** 1x AT8236
* **Microcontroller:** 1x Raspberry Pi Pico
* **Voltage Regulator (5V):** 1x CKCS-BK-2
* **LiDAR:** 5x TFLuna
* **Camera:** OpenMV M7
* **Compass:** GY-273/271
* **Battery:** Nano-tech 1300mAh 3S LiPo
