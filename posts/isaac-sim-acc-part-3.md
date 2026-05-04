---
title: "Isaac Sim Accelerated: Part 3"
slug: "isaac-sim-acc-part-3"
date: "2024-07-03"
excerpt: "Part 3 of the Isaac Sim Series focuses on connecting the robot and its sensors to ROS1 Noetic using action graphs. I've written utility functions that you can use to simplify building the action graphs that can get really tedious to make."
coverImage: "/assets/images/isaac-sim-acc-part-3/actiongraph.png"
tags:
  - "Tutorial"
  - "Simulation"
  - "Robotics"
series: "IsaacSim"
seriesOrder: 3
---

Git Repository: <https://github.com/ishandotsh/isaac-sim-starter>

## Recap

Once all sensors are attached to the robot from [Part 2](/posts/isaac-sim-acc-part-2), we can access the sensor data through ROS using action graphs.

## Connecting to ROS (ActionGraph)

With the environment, robot, and sensors ready we can start publishing topics. The way to do that in Isaac is to use action graphs - similar to Unity, but for robots.

Go through the ROS tutorials on the Isaac Sim documentation or you’ll feel lost in this section: <https://docs.omniverse.nvidia.com/isaacsim/latest/ros_tutorials/index.html>

BTW, this is the cheatsheet part of the article. Writing out these actiongraphs is kind of tedious.

### Cameras

Let’s build an actiongraph that publishes the camera’s image to /camera/color and camera info to /camera/camera_info. Here’s how to do it using the GUI (annoying): <https://docs.omniverse.nvidia.com/isaacsim/latest/ros_tutorials/tutorial_ros_camera.html>

![actiongraph](/assets/images/isaac-sim-acc-part-3/actiongraph.png)

In python (also annoying, but less mouse clicking):

```python
# Enable ROS1 Bridge extension (for ROS1 Nodes)
from omni.isaac.core.utils.extensions import enable_extension
enable_extension("omni.isaac.ros_bridge")

import omni.graph.core as og
import usdrt.Sdf
controller = og.Controller
keys = controller.Keys

camera_graph_config = {"graph_path": "/CameraActionGraph", "evaluator_name": "execution"}
# https://docs.omniverse.nvidia.com/kit/docs/omni.graph/latest/omni.graph.core/omni.graph.core.Controller.html#omni.graph.core.Controller.edit

camera_graph, _, _, _ = controller.edit(
     camera_graph_config,
     {
          keys.CREATE_NODES: [
               ("OnPlaybackTick", "omni.graph.action.OnPlaybackTick"),
               ("CreateRenderProduct",  "omni.isaac.core_nodes.IsaacCreateRenderProduct"),
               ("CameraHelperRgb",   "omni.isaac.ros_bridge.ROS1CameraHelper"),
               ("CameraHelperInfo",  "omni.isaac.ros_bridge.ROS1CameraHelper"),
          ],
          keys.CONNECT: [
               ("OnPlaybackTick.outputs:tick", "CreateRenderProduct.inputs:execIn"),
               ("CreateRenderProduct.outputs:execOut", "CameraHelperRgb.inputs:execIn"),
               ("CreateRenderProduct.outputs:execOut", "CameraHelperInfo.inputs:execIn"),
               ("CreateRenderProduct.outputs:renderProductPath", "CameraHelperRgb.inputs:renderProductPath"),
               ("CreateRenderProduct.outputs:renderProductPath", "CameraHelperInfo.inputs:renderProductPath"),
          ],
          keys.SET_VALUES: [
               ("CreateRenderProduct.inputs:cameraPrim", [usdrt.Sdf.Path(camera_path)]),
               ("CameraHelperRgb.inputs:frameId", "camera"),
               ("CameraHelperRgb.inputs:topicName", "camera/color"),
               ("CameraHelperRgb.inputs:type", "rgb"),
               ("CameraHelperInfo.inputs:frameId", "camera"),
               ("CameraHelperInfo.inputs:topicName", "camera/camera_info"),
               ("CameraHelperInfo.inputs:type", "camera_info"),
          ]     
     }
)
```

```bash
$ rostopic list
/camera/camera_info
/camera/color
/rosout
/rosout_agg
```

In RVIZ:

![rviz](/assets/images/isaac-sim-acc-part-3/rviz.png)

What I like to do is build the simplest graph then add nodes using helper functions. All helper functions are available at utils/utils.py in the repo.

Here’s the simplest graph with a OnPlaybackTick node, and a publish ROS Clock node:

```python
graph_config = {"graph_path": "/ActionGraph", "evaluator_name": "execution"}
graph, _, _, _ = controller.edit(
     graph_config,
     {
          keys.CREATE_NODES: [
               ("OnPlaybackTick", "omni.graph.action.OnPlaybackTick"),
               ("ReadSimTime", "omni.isaac.core_nodes.IsaacReadSimulationTime"),
               ("PublishClock", "omni.isaac.ros_bridge.ROS1PublishClock"),
          ],
          og.Controller.Keys.CONNECT: [
               ("OnPlaybackTick.outputs:tick", "PublishClock.inputs:execIn"),
               ("ReadSimTime.outputs:simulationTime", "PublishClock.inputs:timeStamp"),
          ],
          og.Controller.Keys.SET_VALUES: [
               ("PublishClock.inputs:topicName", "/clock"),
          ]
     }
)
```

![simple-ag](/assets/images/isaac-sim-acc-part-3/simple-ag.png)

Then use helper functions to attach any number of cameras/lidars. Note that these don't "add" the sensor to the robot, they add the action graph nodes to the action graph.

```python
def add_camera(
        graph: og.Graph,
        camera_path, # full path to camera prim
        camera_name, # node identifier (not related to ros)
        colorFrameId,
        colorTopicName,
        infoFrameId,
        infoTopicName,
        depthFrameId = None,
        depthTopicName = None):

    isDepthCam = False
    if(type(depthFrameId) != type(depthTopicName)):
        print("You must provide both depthFrameId and depthTopicName to create a depth camera")
        print("Skipping creating depth camera")
        isDepthCam = False
    if(type(depthFrameId) == str):
        isDepthCam = True

    graph_path = graph.get_path_to_graph()
    tick_node_path = graph_path + '/OnPlaybackTick'
    create_render_path = graph_path + '/CreateRenderProduct' + camera_name
    rgb_path = graph_path + '/CameraHelperRgb' + camera_name
    info_path = graph_path + '/CameraHelperInfo' + camera_name
    
    controller = og.Controller
    controller.create_node(create_render_path, "omni.isaac.core_nodes.IsaacCreateRenderProduct")
    controller.create_node(rgb_path,    "omni.isaac.ros_bridge.ROS1CameraHelper")
    controller.create_node(info_path,   "omni.isaac.ros_bridge.ROS1CameraHelper")

    controller.connect(tick_node_path+'.outputs:tick',create_render_path+'.inputs:execIn')
    controller.connect(create_render_path+'.outputs:execOut',rgb_path+'.inputs:execIn')
    controller.connect(create_render_path+'.outputs:execOut',info_path+'.inputs:execIn')
    controller.connect(create_render_path+'.outputs:renderProductPath', rgb_path+'.inputs:renderProductPath')
    controller.connect(create_render_path+'.outputs:renderProductPath', info_path+'.inputs:renderProductPath')

    controller.attribute(create_render_path+'.inputs:cameraPrim').set([usdrt.Sdf.Path(camera_path)])
    controller.attribute(rgb_path+'.inputs:frameId').set(colorFrameId)
    controller.attribute(info_path+'.inputs:frameId').set(infoFrameId)
    controller.attribute(rgb_path+'.inputs:topicName').set(colorTopicName)
    controller.attribute(info_path+'.inputs:topicName').set(infoTopicName)
    controller.attribute(rgb_path+'.inputs:type').set("rgb")
    controller.attribute(info_path+'.inputs:type').set("camera_info")

    if(isDepthCam):
        depth_path = graph_path + '/CameraHelperDepth' + camera_name
        controller.create_node(depth_path,   "omni.isaac.ros_bridge.ROS1CameraHelper")
        controller.connect(create_render_path+'.outputs:execOut',depth_path+'.inputs:execIn')
        controller.connect(create_render_path+'.outputs:renderProductPath', depth_path+'.inputs:renderProductPath')
        controller.attribute(depth_path+'.inputs:frameId').set(depthFrameId)
        controller.attribute(depth_path+'.inputs:topicName').set(depthTopicName)
        controller.attribute(depth_path+'.inputs:type').set("depth")
```

Lets add the camera through this helper function:

```python
add_camera(graph, camera_path=camera_path, camera_name="my_camera",
                    colorFrameId="camera", colorTopicName="camera/color",
          infoFrameId="camera", infoTopicName="camera/camera_info")
```

![camera-ag](/assets/images/isaac-sim-acc-part-3/camera-ag.png)

### Lidar

```python
def add_lidar(
        graph: og.Graph,
        lidar_path,
        lidar_name,
        lidarFrameId,
        lidarTopicName,
        lidarType = "laser_scan" # or point_cloud
    ):
    graph_path = graph.get_path_to_graph()
    tick_node_path = graph_path + '/OnPlaybackTick'
    create_render_path = graph_path + '/CreateRenderProduct' + lidar_name
    lidar_helper_path = graph_path + '/LidarHelper' + lidar_name

    controller = og.Controller
    controller.create_node(create_render_path, "omni.isaac.core_nodes.IsaacCreateRenderProduct")
    controller.create_node(lidar_helper_path,    "omni.isaac.ros_bridge.ROS1RtxLidarHelper")

    controller.connect(tick_node_path+'.outputs:tick',create_render_path+'.inputs:execIn')
    controller.connect(create_render_path+'.outputs:execOut',lidar_helper_path+'.inputs:execIn')
    controller.connect(create_render_path+'.outputs:renderProductPath', lidar_helper_path+'.inputs:renderProductPath')

    controller.attribute(create_render_path+'.inputs:cameraPrim').set([usdrt.Sdf.Path(lidar_path)])
    controller.attribute(lidar_helper_path+'.inputs:frameId').set(lidarFrameId)
    controller.attribute(lidar_helper_path+'.inputs:topicName').set(lidarTopicName)
    controller.attribute(lidar_helper_path+'.inputs:type').set(lidarType)
```

```python
add_lidar(graph, lidar_parent+"/"+lidar_path, "my_lidar", 
          "laser", "scan", "laser_scan")
# Notice the lidar path needs to be the full path: 
# /turtlebot3_waffle_pi/base_scan/lidar
# We defined those earlier when we added the lidar
```

I spawned in the Simple Room environment and this is what I see in RVIZ:

![lidar_rviz](/assets/images/isaac-sim-acc-part-3/lidar_rviz.png)

In the spirit of completeness, here’s how to publish PhysX Lidar output via actiongraph in python. This is not a helper function, if you want to use this add it to the simplest action graph we created at the start.

```python
# This won't work if the original ActionGraph is also uncommented
og.Controller.edit(
     {"graph_path": "/ActionGraph", "evaluator_name": "execution"},
     {
          og.Controller.Keys.CREATE_NODES: [
               ("ReadSimTime", "omni.isaac.core_nodes.IsaacReadSimulationTime"),
               ("OnPlaybackTick", "omni.graph.action.OnPlaybackTick"),
               ("PublishClock", "omni.isaac.ros_bridge.ROS1PublishClock"),

               ("ReadLidar", "omni.isaac.range_sensor.IsaacReadLidarBeams"),
               ("PublishLidar", "omni.isaac.ros_bridge.ROS1PublishLaserScan"),
          ],
          og.Controller.Keys.CONNECT: [
               ("OnPlaybackTick.outputs:tick", "PublishClock.inputs:execIn"),
               ("ReadSimTime.outputs:simulationTime", "PublishClock.inputs:timeStamp"),
               ("OnPlaybackTick.outputs:tick", "ReadLidar.inputs:execIn"),
               ("ReadSimTime.outputs:simulationTime", "PublishLidar.inputs:timeStamp"),
               ("ReadLidar.outputs:execOut",               "PublishLidar.inputs:execIn"),
               ("ReadLidar.outputs:azimuthRange",          "PublishLidar.inputs:azimuthRange"),
               ("ReadLidar.outputs:depthRange",            "PublishLidar.inputs:depthRange"),
               ("ReadLidar.outputs:horizontalFov",         "PublishLidar.inputs:horizontalFov"),
               ("ReadLidar.outputs:horizontalResolution",  "PublishLidar.inputs:horizontalResolution"),
               ("ReadLidar.outputs:intensitiesData",       "PublishLidar.inputs:intensitiesData"),
               ("ReadLidar.outputs:linearDepthData",       "PublishLidar.inputs:linearDepthData"),
               ("ReadLidar.outputs:numCols",               "PublishLidar.inputs:numCols"),
               ("ReadLidar.outputs:numRows",               "PublishLidar.inputs:numRows"),
               ("ReadLidar.outputs:rotationRate",          "PublishLidar.inputs:rotationRate"),
          ],
          og.Controller.Keys.SET_VALUES: [
               ("PublishClock.inputs:topicName", "/clock"),
               ("ReadLidarB.inputs:lidarPrim", "/turtlebot3_waffle_pi/base_scan/lidar"),
               ("PublishLidarB.inputs:frameId", "laser"),
               ("PublishLidarB.inputs:topicName", "scan"),
          ]
     }
)
```

### IMU

```python
def add_imu(graph, imu_path, imuFrameId, imuTopicName):
     graph_path = graph.get_path_to_graph()
     tick_node_path = graph_path + '/OnPlaybackTick'
     ros_clock_node_path = graph_path + '/ReadSimTime'
     read_imu_path = graph_path + '/ReadIMU'
     pub_imu_path = graph_path + '/PublishIMU'

     controller = og.Controller
     controller.create_node(read_imu_path, "omni.isaac.sensor.IsaacReadIMU")
     controller.create_node(pub_imu_path, "omni.isaac.ros_bridge.ROS1PublishImu")

     controller.connect(tick_node_path+'.outputs:tick', read_imu_path+'.inputs:execIn')
     controller.connect(ros_clock_node_path+'.outputs:simulationTime', pub_imu_path+'.inputs:timeStamp')
     controller.connect(read_imu_path+'.outputs:execOut', pub_imu_path+'.inputs:execIn')
     controller.connect(read_imu_path+'.outputs:linAcc', pub_imu_path+'.inputs:linearAcceleration')
     controller.connect(read_imu_path+'.outputs:angVel', pub_imu_path+'.inputs:angularVelocity')
     controller.connect(read_imu_path+'.outputs:orientation', pub_imu_path+'.inputs:orientation')

     controller.attribute(read_imu_path+'.inputs:imuPrim').set([usdrt.Sdf.Path(imu_path)])
     controller.attribute(pub_imu_path+'.inputs:frameId').set(imuFrameId)
     controller.attribute(pub_imu_path+'.inputs:topicName').set(imuTopicName)

add_imu(graph, imu_parent+'/'+imu_path, "IMU", "imu")
```

### Teleop

This is where the concept of Articulations comes in. You have to identify the articulation root for the robot, in this case its “base_footprint”. In custom robots not imported via URDF, you’ll have to add the ArticulationAPI yourself. The joint_names parameter is the same as the ones we applied the DriveAPI to, so we can just pass that same list in. More info: <https://docs.omniverse.nvidia.com/isaacsim/latest/ros_tutorials/tutorial_ros_drive_turtlebot.html>

```python
from typing import List
def add_diff_teleop(graph, robot_path, joint_names:List[str], max_linear_speed, wheel_distance, wheel_radius, topic_name):
     graph_path = graph.get_path_to_graph()
     tick_node_path = graph_path + '/OnPlaybackTick'
     sub_twist_path = graph_path + '/SubscribeTwistDiff'
     scale_path = graph_path + '/ScaleWheel'
     break_ang_path = graph_path + '/Break3_VectorAngVel'
     break_lin_path = graph_path + '/Break3_VectorLinVel'
     diff_contr_path = graph_path + '/DiffController'
     art_contr_path = graph_path + '/ArticulationController'

         controller = og.Controller
     controller.create_node(sub_twist_path, "omni.isaac.ros_bridge.ROS1SubscribeTwist")
     controller.create_node(scale_path, "omni.isaac.core_nodes.OgnIsaacScaleToFromStageUnit")
     controller.create_node(break_ang_path, "omni.graph.nodes.BreakVector3")
     controller.create_node(break_lin_path, "omni.graph.nodes.BreakVector3")
     controller.create_node(diff_contr_path, "omni.isaac.wheeled_robots.DifferentialController")
     controller.create_node(art_contr_path, "omni.isaac.core_nodes.IsaacArticulationController")

     controller.connect(tick_node_path+'.outputs:tick',sub_twist_path+'.inputs:execIn')
     controller.connect(tick_node_path+'.outputs:tick',art_contr_path+'.inputs:execIn')
     controller.connect(sub_twist_path+'.outputs:execOut',diff_contr_path+'.inputs:execIn')
     controller.connect(sub_twist_path+'.outputs:angularVelocity',break_ang_path+'.inputs:tuple')
     controller.connect(sub_twist_path+'.outputs:linearVelocity',scale_path+'.inputs:value')
     controller.connect(scale_path+'.outputs:result',break_lin_path+'.inputs:tuple')
     controller.connect(break_ang_path+'.outputs:z',diff_contr_path+'.inputs:angularVelocity')
     controller.connect(break_lin_path+'.outputs:x',diff_contr_path+'.inputs:linearVelocity')
     controller.connect(diff_contr_path+'.outputs:velocityCommand',art_contr_path+'.inputs:velocityCommand')

     controller.attribute(sub_twist_path+'.inputs:topicName').set(topic_name)
     controller.attribute(diff_contr_path+'.inputs:maxLinearSpeed').set(max_linear_speed)
     controller.attribute(diff_contr_path+'.inputs:wheelDistance').set(wheel_distance)
     controller.attribute(diff_contr_path+'.inputs:wheelRadius').set(wheel_radius)
     controller.attribute(art_contr_path+'.inputs:usePath').set(True)
     controller.attribute(art_contr_path+'.inputs:robotPath').set(robot_path)
     controller.attribute(art_contr_path+'.inputs:jointNames').set(joint_names)

add_diff_teleop(graph, str(robot_prim.GetPrimPath())+'/base_footprint', velocity_driven_joints, 0.26, 0.3, 0.066, "cmd_vel")
```

### Odom

Publish odom→base_footprint transform on /tf and odometry on /odom:

```python
def add_odometry(graph, ogn_node_name, chassis_prim_path, chassis_frame_id, odom_frame_id, odom_topic_name):
     graph_path = graph.get_path_to_graph()
     tick_node_path = graph_path + '/OnPlaybackTick'
     ros_clock_node_path = graph_path + '/ReadSimTime'
     compute_odom_path = graph_path + '/' + ogn_node_name
     pub_odom_path = graph_path + '/Pub' + ogn_node_name
     pub_raw_tf_path = graph_path + '/' + 'PublishRawTFTree'

     controller = og.Controller
     controller.create_node(compute_odom_path, "omni.isaac.core_nodes.IsaacComputeOdometry") 
     controller.create_node(pub_odom_path, "omni.isaac.ros_bridge.ROS1PublishOdometry")
     controller.create_node(pub_raw_tf_path, "omni.isaac.ros_bridge.ROS1PublishRawTransformTree")

     controller.connect(tick_node_path+'.outputs:tick',compute_odom_path+'.inputs:execIn')
     controller.connect(tick_node_path+'.outputs:tick',pub_odom_path+'.inputs:execIn')
     controller.connect(ros_clock_node_path+'.outputs:simulationTime',pub_odom_path+'.inputs:timeStamp')
     controller.connect(compute_odom_path+'.outputs:execOut',pub_odom_path+'.inputs:execIn')
     controller.connect(compute_odom_path+'.outputs:angularVelocity',pub_odom_path+'.inputs:angularVelocity')
     controller.connect(compute_odom_path+'.outputs:linearVelocity',pub_odom_path+'.inputs:linearVelocity')
     controller.connect(compute_odom_path+'.outputs:orientation',pub_odom_path+'.inputs:orientation')
     controller.connect(compute_odom_path+'.outputs:position',pub_odom_path+'.inputs:position')
     controller.connect(compute_odom_path+'.outputs:execOut',pub_raw_tf_path+'.inputs:execIn')
     controller.connect(compute_odom_path+'.outputs:orientation',pub_raw_tf_path+'.inputs:rotation')
     controller.connect(compute_odom_path+'.outputs:position',pub_raw_tf_path+'.inputs:translation')
     controller.connect(ros_clock_node_path+'.outputs:simulationTime',pub_raw_tf_path+'.inputs:timeStamp')

     controller.attribute(compute_odom_path+'.inputs:chassisPrim').set(chassis_prim_path)
     controller.attribute(pub_odom_path+'.inputs:chassisFrameId').set(chassis_frame_id)
     controller.attribute(pub_odom_path+'.inputs:odomFrameId').set(odom_frame_id)
     controller.attribute(pub_odom_path+'.inputs:topicName').set(odom_topic_name)
     controller.attribute(pub_raw_tf_path+'.inputs:childFrameId').set(chassis_frame_id)
     controller.attribute(pub_raw_tf_path+'.inputs:parentFrameId').set(odom_frame_id)
     controller.attribute(pub_raw_tf_path+'.inputs:topicName').set("tf")

add_odometry(graph, "ComputeOdometry", str(robot_prim.GetPrimPath())+'/base_footprint',
     "base_footprint", "odom", "odom")
```

### TF (tf and tf_static)

```python
from typing import Optional
def add_tf(graph, ogn_node_name, target_prims: List[str], topic_name = "tf", parent_prim: Optional[str] = None, namespace: Optional[str] = None):
     graph_path = graph.get_path_to_graph()
     tick_node_path = graph_path + '/OnPlaybackTick'
     ros_clock_node_path = graph_path + '/ReadSimTime'
     publish_tf_path = graph_path + '/' + ogn_node_name

     controller = og.Controller
     controller.create_node(publish_tf_path, "omni.isaac.ros_bridge.ROS1PublishTransformTree")

     controller.connect(tick_node_path+'.outputs:tick',publish_tf_path+'.inputs:execIn')
     controller.connect(ros_clock_node_path+'.outputs:simulationTime', publish_tf_path+'.inputs:timeStamp')

     controller.attribute(publish_tf_path+'.inputs:targetPrims').set(target_prims)
     if(namespace is not None):
          controller.attribute(publish_tf_path+'.inputs:nodeNamespace').set(namespace)
     if(parent_prim is not None):
          controller.attribute(publish_tf_path+'.inputs:parentPrim').set(parent_prim)
```

Isaac Sim will automatically parse links to publish the TF for the entire robot given the articulation root of the robot as the target_prim:

```python
add_tf(graph, "PubTF", target_prims=[str(robot_prim.GetPrimPath())+'/base_link'])
```

![tree1](/assets/images/isaac-sim-acc-part-3/tree1.png)

This will however, publish with “world” as the root node. To prevent that, build the TF tree manually. A lot of ROS packages require publishing of static TFs on /tf_static. This is possible to do through this helper too:

```python
# manual tf tree
# base_footprint -> base_link on /tf_static
add_tf(graph, "PubTFBaseStatic", [str(robot_prim.GetPrimPath())+'/base_link'], "tf_static", str(robot_prim.GetPrimPath())+'/base_footprint')

# defines base_link -> (all other joints) on /tf_static
static_links = [
     "camera_link", "caster_back_left_link",
     "caster_back_right_link", "imu_link", "base_scan",
]
path_prefix = str(robot_prim.GetPrimPath()) + '/'
static_links_paths = [path_prefix + link for link in static_links]

add_tf(graph, "PubTFStatic", static_links_paths, "tf_static", str(robot_prim.GetPrimPath())+'/base_link')

# base_link -> wheel links on /tf
wheel_links = ["wheel_left_link", "wheel_right_link"]
wheel_links_paths = [path_prefix + link for link in wheel_links]

add_tf(graph, "PubTFWheels", wheel_links_paths, "tf", str(robot_prim.GetPrimPath())+'/base_link')
```

The result is essentially the same, you can add the camera’s links back through the helper too.

![tree_manual](/assets/images/isaac-sim-acc-part-3/tree_manual.png)

## Wrap up

Run the script

```bash
roscore

# in another terminal 
./python.sh ./isaac-sim-starter/isaac.py

# check ros stuff
rosnode list
rostopic list

# check RVIZ
rviz
```

With that, you have a working robot in Isaac Sim with the foundational work done. I believe this is a good jumping off point to build your simulation. I'll list out some features that I wanted to add to this series but haven't yet:

- Custom action graph nodes
- Script nodes
- Cloner
- Dynamic Environments

and some features that I'd like to see added to Isaac Sim:

- An API for OnShape Importer
- Easier method to add retro-reflective material to objects for lidars
- A fix for RTX Lidar max_angle not working

If you've worked on any of the listed items and could point me to your work [contact me](/contact)
