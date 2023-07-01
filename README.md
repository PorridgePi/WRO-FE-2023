# WRO 2023 Future Engineers

## Usage

Using Visual Studio Code:
- Clone this repository
- Change directory
- Initialise Git submodule(s): `git submodule update --init --recursive`
- Open the repository in VSCode
- Install the PlatformIO plugin
- Use the PlatformIO plugin to compile and upload code onto the microcontrollers

## Repository Content
- `.github/workflows/platformio-ci.yml`: GitHub Actions CI workflow for PlatformIO ([Documentation](https://docs.platformio.org/en/latest/integration/ci/github-actions.html))
- `.vscode/`: Folder containing VSCode workspace settings
    - `extensions.json`: List of recommended and unwanted extensions ([Documentation](https://code.visualstudio.com/docs/editor/extension-gallery#_workspace-recommended-extensions))
- `models/`: 3D models
- `others/`: Other files
- `schemes/`: Schematic diagrams
- `scripts/`: Scripts for PlatformIO
    - `ci.sh`: Script for CI test
    - `extra_scripts.py`: Extra scripts for PlatformIO (run before and after build - [Documentation](https://docs.platformio.org/en/latest/scripting/actions.html))
- `src/`: Main code
    - `lib/`: Libraries for components
        - `private/`: Our own libraries for components
        - `public/`: Libraries from other sources
    - `test/`: Test code
    - `main.cpp`: Main code for Raspberry Pi Pico
- `t-photos`: Team photo(s)
- `v-photos`: 6 photos of the vehicle (from every side, from top and bottom)
- `video`: Contains [video.md](video/video.md) with the link to the video of the driving demonstration
- `.clang-format`: ClangFormat code style file - to format code in VSCode
- `.gitignore`: gitignore file ([Documentation](https://git-scm.com/docs/gitignore))
- `platformio.ini`: PlatformIO configuration file ([Documentation](https://docs.platformio.org/en/stable/projectconf/index.html))
- `README.md`: This file

# Team Members
- [Yikun](https://github.com/PorridgePi)
- [Zachary](https://github.com/Zachareeeeee)
