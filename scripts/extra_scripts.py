Import("env")

import os, socket, platform

def preBuild(source, target, env):
    print("----- EXECUTING PRE-BUILD SCRIPT -----")

    hostname = socket.gethostname()
    system = platform.system()

    if system == 'Darwin' and 'MBP' in hostname:
        if os.path.exists('/Applications/Xcode.app/Contents/Developer'):
            os.rename('/Applications/Xcode.app/Contents/Developer', '/Applications/Xcode.app/Contents/Developer.bak')
            print("INFO: Xcode renamed")
        else:
            print("WARN: Xcode already renamed")

    print("----- PRE-BUILD SCRIPT DONE -----")

def postBuild(source, target, env):
    print("----- EXECUTING POST-BUILD SCRIPT -----")

    hostname = socket.gethostname()
    system = platform.system()

    if system == 'Darwin' and hostname == 'MBP':
        if os.path.exists('/Applications/Xcode.app/Contents/Developer.bak'):
            os.rename('/Applications/Xcode.app/Contents/Developer.bak', '/Applications/Xcode.app/Contents/Developer')
            print("INFO: Xcode renamed back")
        else:
            print("WARN: Xcode (probably) renamed back")
    
    print("----- POST-BUILD SCRIPT DONE -----")

preBuild(None, None, None)
env.AddPostAction("checkprogsize", postBuild)
