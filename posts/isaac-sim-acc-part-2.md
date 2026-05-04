---
title: "Isaac Sim Accelerated: Part 2"
slug: "isaac-sim-acc-part-2"
date: "2024-07-02"
excerpt: "Part 2 of the Isaac Sim Series. I cover importing a robot through URDF, setting up its joint properties via python, and provide snippets for adding lidar, camera, and imu sensors."
coverImage: "/assets/images/isaac-sim-acc-part-2/urdf-import.jpg"
tags:
  - "Tutorial"
  - "Simulation"
  - "Robotics"
series: "IsaacSim"
seriesOrder: 2
---

Git Repository: <https://github.com/ishandotsh/isaac-sim-starter>

## Recap

Make sure you've set up the base script from [Part 1](/posts/isaac-sim-acc-part-1) and ran it.

## Getting your robot in the correct format

Depending on your situation, one of these will be the way to get your robot description in USD:

1.  Import existing URDF
2.  Rig a model inside Isaac Sim ([Rigging Robots](https://docs.omniverse.nvidia.com/isaacsim/latest/advanced_tutorials/tutorial_advanced_rigging_robot.html) section of the documentation)
3.  Import a CAD model from OnShape

### Import URDF

💡 IMPORTANT: Any mesh paths in the URDF need to be replaced with full paths (or you can source the workspace containing the description before launching Isaac)

Here’s how to import a URDF through python:

```python
from omni.importer.urdf import _urdf

status, robot_import_config = omni.kit.commands.execute("URDFCreateImportConfig")
robot_import_config.merge_fixed_joints = False
robot_import_config.convex_decomp = True # Collision
robot_import_config.import_inertia_tensor = True
robot_import_config.fix_base = False
robot_import_config.distance_scale = 1

# 
robot_import_config.default_drive_type = _urdf.UrdfJointTargetType.JOINT_DRIVE_NONE

robot_urdf_path = "/PATH/isaac-sim-starter/assets/turtlebot3_waffle_pi/urdf/turtlebot3_waffle_pi.urdf" # change this
status, robot_prim_path = omni.kit.commands.execute(
     "URDFParseAndImportFile",
     urdf_path=robot_urdf_path,
     import_config=robot_import_config,
     get_articulation_root=True,
)
```

To import a urdf through the GUI, follow NVIDIA’s tutorial: <https://docs.omniverse.nvidia.com/isaacsim/latest/ros_tutorials/tutorial_ros_turtlebot.html>

💡 URDF Importer Docs:

<https://docs.omniverse.nvidia.com/kit/docs/omniverse-urdf-importer/latest/source/extensions/omni.importer.urdf/docs/index.html>

The next step is to set the joint properties for the castor wheels and the drive wheels. The most important ones are joint friction, max velocity, damping, and stiffness. In addition, the drive wheel joints need to have the DriveAPI attached to them.

This is the full code, breakdown is below it:

```python
from typing import List

velocity_driven_joints = ['wheel_left_joint', 'wheel_right_joint']
position_driven_joints = []
undriven_joints = []

def get_robot_description(robot_prim: Usd.Prim) -> List[Usd.Prim]:
     robot_description = []

     def gather_paths(prim: Usd.Prim):
          for child_prim in prim.GetAllChildren():
               if child_prim.GetTypeName() not in ["Mesh", "Shader", "Material", "Scope"]:
               # print(child_prim.GetPath().pathString, " -> ", child_prim.GetTypeName())
               robot_description.append(child_prim)
               gather_paths(child_prim)

     gather_paths(robot_prim)
     return robot_description

robot_prim = stage.GetPrimAtPath(robot_prim_path).GetParent()
robot_tree = get_robot_description(robot_prim)

# Set velocity, position, or undriven joints
for prim in robot_tree:
     prim_type = prim.GetTypeName()
     prim_path = prim.GetPath()
     if prim_type == "PhysicsRevoluteJoint":
          # print("At ", prim.GetPath().pathString, end=" ")
          prim_name = prim_path.pathString.split("/")[-1].strip()
     if prim_name in velocity_driven_joints:
          # print("-> Setting Velocity")
          drive = UsdPhysics.DriveAPI.Get(prim, "angular")
          drive.GetStiffnessAttr().Set(0)
          drive.GetDampingAttr().Set(1e10)
     elif prim_name in position_driven_joints:
          # print("-> Setting Position")
          drive = UsdPhysics.DriveAPI.Get(prim, "angular")
          drive.GetStiffnessAttr().Set(1e10)
          drive.GetDampingAttr().Set(0)
     else:
          # print("-> Setting Undriven")
          # print("Prop Names: ")
          # print(prim.GetPropertyNames())
          prim.RemoveAPI(UsdPhysics.DriveAPI, "angular")
          prim.GetProperty("physxJoint:jointFriction").Set(0.001)
          prim.GetProperty("physxJoint:maxJointVelocity").Set(4.0)
```

Let me break it down for you

![break it down](/assets/images/isaac-sim-acc-part-2/dance-skeleton.gif)

The `get_robot_description` method traverses the prim paths of the robot and returns a flat list of all prims. This is not strictly necessary, and a similar method is probably already implemented in the OpenUSD module but this was easier than reading the documentation for me. If you find it, let me know - I'll update this, and credit you.

```python
def get_robot_description(robot_prim: Usd.Prim) -> List[Usd.Prim]:
     robot_description = []

     def gather_paths(prim: Usd.Prim):
          for child_prim in prim.GetAllChildren():
               if child_prim.GetTypeName() not in ["Mesh", "Shader", "Material", "Scope"]:
               # print(child_prim.GetPath().pathString, " -> ", child_prim.GetTypeName())
               robot_description.append(child_prim)
               gather_paths(child_prim)

     gather_paths(robot_prim)
     return robot_description

robot_prim = stage.GetPrimAtPath(robot_prim_path).GetParent()
robot_tree = get_robot_description(robot_prim)
```

The joints lists take in the name of the joints defined in the URDF. Then we loop through the robot's prims and find any `PhysXRevoluteJoint`s and apply the appropriate API and properties. Any joint tuning you may have done by hand in the GUI can be added here provided you can find out the property name (there's a method for that in the comments).

The [joint tuning guide](https://docs.omniverse.nvidia.com/isaacsim/latest/advanced_tutorials/tutorial_advanced_joint_tuning.html) is essential for this process. You can also look up the [rigging robots section](https://docs.omniverse.nvidia.com/isaacsim/latest/advanced_tutorials/tutorial_advanced_rigging_robot.html) of the documentation.

```python
from typing import List

velocity_driven_joints = ['wheel_left_joint', 'wheel_right_joint']
position_driven_joints = []
undriven_joints = []

# Set velocity, position, or undriven joints
for prim in robot_tree:
     prim_type = prim.GetTypeName()
     prim_path = prim.GetPath()
     if prim_type == "PhysicsRevoluteJoint":
          # print("At ", prim.GetPath().pathString, end=" ")
          prim_name = prim_path.pathString.split("/")[-1].strip()
        if prim_name in velocity_driven_joints:
            # print("-> Setting Velocity")
            drive = UsdPhysics.DriveAPI.Get(prim, "angular")
            drive.GetStiffnessAttr().Set(0)
            drive.GetDampingAttr().Set(1e10)
        elif prim_name in position_driven_joints:
            # print("-> Setting Position")
            drive = UsdPhysics.DriveAPI.Get(prim, "angular")
            drive.GetStiffnessAttr().Set(1e10)
            drive.GetDampingAttr().Set(0)
        else:
            # print("-> Setting Undriven")
            # print("Prop Names: ")
            # print(prim.GetPropertyNames())
            prim.RemoveAPI(UsdPhysics.DriveAPI, "angular")
            prim.GetProperty("physxJoint:jointFriction").Set(0.001)
            prim.GetProperty("physxJoint:maxJointVelocity").Set(4.0)
```

Running the script till here:

![urdf-import](/assets/images/isaac-sim-acc-part-2/urdf-import.jpg)

and the joint properties:

![joint-props](/assets/images/isaac-sim-acc-part-2/joint-props.png)

## Attaching Sensors

This section covers attaching sensors to the robot. I’ll discuss publishing the data through ROS in the next post.

### Lidars

We have 2 options:

- [PhysX Lidar](https://docs.omniverse.nvidia.com/isaacsim/latest/features/sensors_simulation/ext_omni_isaac_range_sensor.html#isaac-sim-physx-lidar-example) → no intensity data: 255 for hit, 0 for no hit
- [RTX Lidar](https://docs.omniverse.nvidia.com/isaacsim/latest/features/sensors_simulation/isaac_sim_sensors_rtx_based_lidar.html)

RTX Lidar support is way better than PhysX, however clipping the max_angle of RTX Lidars was broken at the time of writing this post. There are workarounds for that but hopefully NVIDIA will fix it soon.

- `lidar_path`: name of the lidar prim (can be anything)
- `lidar_parent`: prim name of the robot's lidar link
- `lidar_config`: pre-configure JSON files. Read more in the [documentation](https://docs.omniverse.nvidia.com/isaacsim/latest/features/sensors_simulation/isaac_sim_sensors_rtx_based_lidar.html#lidar-config-files)

```python
lidar_path = 'lidar'
lidar_parent = str(robot_prim.GetPrimPath()) + '/base_scan'

# RTX

# $ISAAC_PATH/exts/omni.isaac.sensor/data/lidar_configs for a list of other configs
lidar_config = "Example_Rotary"

_, sensor = omni.kit.commands.execute(
     "IsaacSensorCreateRtxLidar",
     path=lidar_path,
     parent=lidar_parent,
     config=lidar_config,
     orientation=Gf.Quatd(1.0, 0.0, 0.0, 0.0) # W, X, Y, Z
)

# PhysX
# _, _ = omni.kit.commands.execute(
#      "RangeSensorCreateLidar",
#      path=lidar_path,
#      parent=lidar_parent,
#      min_range=0.4,
#      max_range=30.0,
#      draw_points=False,
#      draw_lines=True, # set to True to visualize
#      horizontal_fov=360.0,
#      vertical_fov=30.0,
#      horizontal_resolution=0.4,
#      vertical_resolution=4.0,
#      rotation_rate=30.0,
#      high_lod=False,
#      yaw_offset=0.0,
#      enable_semantics=False
# )
```

Unfortunately I haven't played with sensor materials enough to write about them. If I do end up doing that I'll add it here. If you'd like to collaborate with me on that, contact me.

### IMU

💡 Documentation

<https://docs.omniverse.nvidia.com/isaacsim/latest/features/sensors_simulation/isaac_sim_sensors_physics_based_imu.html>

```python
imu_path = 'imu'
imu_parent = str(robot_prim.GetPrimPath()) + '/imu_link'

for prim in stage.TraverseAll():
    if prim.HasAPI(PhysxSchema.PhysxSceneAPI):
        current_physics_prim = prim
physx_scene_api = PhysxSchema.PhysxSceneAPI(current_physics_prim)
current_physics_frequency = physx_scene_api.GetTimeStepsPerSecondAttr().Get() # default = 60
dt = 1.0 / current_physics_frequency 

imu_result, imu_prim = omni.kit.commands.execute(
    "IsaacSensorCreateImuSensor",
    path=imu_path,
    parent=imu_parent,
    sensor_period=dt,
    visualize=False,
    linear_acceleration_filter_size=1,
    angular_velocity_filter_size=1,
    orientation_filter_size=1,
)
```

### Camera

Default camera:

```python
from omni.isaac.sensor import Camera

camera_path = str(robot_prim.GetPrimPath()) + '/camera_rgb_frame/camera'

camera_prim = Camera(
     prim_path=camera_path,
     frequency=20,
     resolution=(256, 256),
)
```

There are easy ways to get the calibration parameters for the cameras. Check out the full documentation here: <https://docs.omniverse.nvidia.com/isaacsim/latest/features/sensors_simulation/isaac_sim_sensors_camera.html#calibrated-camera-sensors>

Cameras seem to be the most loved sensor out of all. The documentation is really good so I’m not going to copy it here, but be sure to look up these files in the Isaac directory to learn more:

- ./standalone_examples/api/omni.isaac.sensor/camera_ros.py
- ./standalone_examples/api/omni.isaac.sensor/camera_opencv.py
- ./standalone_examples/api/omni.isaac.sensor/camera_opencv_fisheye.py

## Wrap up

Run the script

```bash
./python.sh ./isaac-sim-starter/isaac.py
```

You should see the robot on a flat grid.

Create a new viewport for the camera: Window -\> Viewport -\> Viewport 2 and select camera

The next part will discuss how you can access the sensor data through ROS.
