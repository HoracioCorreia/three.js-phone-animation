import React, { PureComponent } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

import './Phone3D.css';

class Phone3D extends PureComponent {
    constructor(props) {
        super(props);
        this.state = {};
        this.isForward = true;

        this.domContainer = null;
        this.isAnimated = false;

        //Controls
        this.naturalRotationEnabled = true;

        //Base rotation vectors
        this.rotateStart = new THREE.Vector2();
        this.rotateEnd = new THREE.Vector2();
        this.rotateDelta = new THREE.Vector2();
        this.naturalRotateSpeed = 0.05;
        this.naturalFriction = 0.99;
        this.baseRotationFriction = 0.95;
        this.zoomFriction = 0.95;
        this.textureFriction = 0.9;

        //Base context
        this.phoneObject = null;
        this.headerFooterObject = null;
        this.naturalDestination = null;
        this.naturalRotation = null;
        this.target = new THREE.Vector3();
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        this.defaultCameraZ = 240 * 1.05;
        this.zoomDestination = this.defaultCameraZ;
        this.textureDestination = new THREE.Vector2(0, 0);

        //Bindings
        this.animate = this.animate.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onDeviceRotation = this.onDeviceRotation.bind(this);
        this.toggleNaturalRotation = this.toggleNaturalRotation.bind(this);
        this.updateBaseRotation = this.updateBaseRotation.bind(this);
        this.forward = this.forward.bind(this);
        this.backward = this.backward.bind(this);
        this.load = this.load.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    componentWillUnmount() {
        document.removeEventListener('mousemove', this.onMouseMove, false);
        window.addEventListener('deviceorientation', this.onDeviceRotation, true);
    }

    componentDidMount() {
        this.load();
    }

    componentDidUpdate(prevProps) {
        if (this.props.lang && this.props.lang !== prevProps.lang) {
            this.load();
        }
    }

    handleResize() {
        this.renderer.setSize(this.domContainer.offsetWidth, this.domContainer.offsetHeight);
        this.naturalDestination = { x: this.rotateStart.x, y: this.rotateStart.y };
        if (this.baseRotation) {
            this.baseRotation.copy(this.phoneObject.rotation);
        }
        this.zoomDestination = this.defaultCameraZ;
    }

    load() {
        if (this.isLoading3D) {
            setTimeout(this.load, 1000);
            return;
        }
        this.isLoading3D = true;

        const dimension = {
            width: this.domContainer.offsetWidth,
            height: this.domContainer.offsetHeight
        };

        if (!this.scene) {
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(60, dimension.width / dimension.height, 0.01, 1000);
            this.scene.add(this.camera);

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(dimension.width, dimension.height);
            this.renderer.physicallyCorrectLights = true;
            this.renderer.gammaOutput = true;
            this.renderer.gammaFactor = 2.2;
            this.renderer.setClearColor(0x000000, 0);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(dimension.width, dimension.height);
            this.domContainer.appendChild(this.renderer.domElement);

            const light1 = new THREE.AmbientLight(0xffffff, 3.1);
            light1.name = 'ambient_light';
            this.camera.add(light1);
        }

        var loader = new GLTFLoader();
        var dracoLoader = new DRACOLoader();

        dracoLoader.setDecoderPath('/three/draco/');
        loader.setDRACOLoader(dracoLoader);

        /*
        var texture = new THREE.TextureLoader().load('/three/textures/landing_texture.jpg');
        var materialScreen = new THREE.MeshStandardMaterial({
            map: texture
        });
        var materialNav = new THREE.MeshStandardMaterial({
            map: texture
        });
        */

        //console.log(this.props.lang === 'fr' ? '../../assets/phone3d_fr.glb' : '../../assets/phone3d.glb');
        const phone3d = require(this.props.lang === 'fr' ? '../assets/media/phone3d_fr.glb' : '../assets/media/phone3d.glb');
        const texture = require('../text/matcap_03.jpg');
        const matcap = new THREE.TextureLoader().load(texture.default, () => {
            matcap.encoding = THREE.sRGBEncoding;

            loader.load(
                phone3d.default,
                gltf => {
                    if (this.phoneObject) {
                        // Remove previously loaded object
                        this.scene.remove(this.phoneObject);
                    }
                    this.phoneObject = gltf.scene || gltf.scenes[0];

                    const box = new THREE.Box3().setFromObject(this.phoneObject);
                    const size = box.getSize(new THREE.Vector3()).length();
                    const center = box.getCenter(new THREE.Vector3());

                    this.phoneObject.position.x += this.phoneObject.position.x - center.x;
                    this.phoneObject.position.y += this.phoneObject.position.y - center.y;
                    this.phoneObject.position.z += this.phoneObject.position.z - center.z;

                    this.camera.position.copy(center);
                    //this.camera.position.x += size / 10.0;
                    //this.camera.position.y -= size / 3.0;
                    this.camera.position.z += size;
                    this.defaultCameraZ = this.camera.position.z;
                    this.camera.lookAt(center);

                    //Add material to iphone
                    this.phoneObject.children[0].material = new THREE.MeshMatcapMaterial({
                        matcap: matcap
                    });

                    //Add materials to screen
                    //this.phoneObject.children[0].children[0].material = materialScreen;
                    //this.phoneObject.children[0].children[1].material = materialNav;

                    for (let i = 0; i < this.phoneObject.children[0].children.length; i++) {
                        if (this.phoneObject.children[0].children[i].name === 'Ecran001') {
                            this.screenObject = this.phoneObject.children[0].children[i];
                        } else if (this.phoneObject.children[0].children[i].name === 'header_footer') {
                            this.headerFooterObject = this.phoneObject.children[0].children[i];
                        }
                    }

                    this.headerFooterObject.material = this.screenObject.material.clone();
                    this.headerFooterObject.material.map = this.screenObject.material.map.clone();
                    this.headerFooterObject.material.map.needsUpdate = true;

                    this.scene.add(this.phoneObject);

                    if (!this.isAnimated) {
                        if (this.props.isForward) {
                            this.forward(0, 0);
                        } else {
                            this.backward(0, 0);
                        }
                        if (this.props.onLoadingDone) {
                            this.props.onLoadingDone();
                        }
                    }

                    if (!this.isAnimated) {
                        this.isAnimated = true;
                        requestAnimationFrame(this.animate);
                        document.addEventListener('mousemove', this.onMouseMove, false);
                        window.addEventListener('deviceorientation', this.onDeviceRotation, false);
                    }
                    this.isLoading3D = false;
                },
                undefined,
                error => {
                    console.log('Error loading 3 obj:', error);
                }
            );
        });
    }

    onMouseMove(event) {
        if (!this.naturalRotationEnabled) {
            return;
        }

        event.preventDefault();
        this.naturalDestination = { x: event.clientX, y: event.clientY };
    }

    onDeviceRotation(event) {
        if (!this.naturalRotationEnabled) {
            return;
        }

        event.preventDefault();
        this.naturalDestination = { x: event.alpha + event.gamma * 5.0, y: (event.beta - 45.0) * 5.0 };
    }

    animate(time) {
        if (!this.isAnimated) return;
        requestAnimationFrame(this.animate);
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    logFn(from, to, friction, padding = 1) {
        const diff = to - from;
        if (to === from || Math.abs(diff) <= padding) {
            return to;
        }
        return to - diff * friction;
    }

    update() {
        if (this.naturalDestination) {
            const destination = {
                x: this.naturalDestination.x - window.innerWidth / 2.0,
                y: this.naturalDestination.y - window.innerHeight / 2.0
            };
            this.rotateEnd.set(
                this.logFn(this.rotateStart.x, destination.x, this.naturalFriction),
                this.logFn(this.rotateStart.y, destination.y, this.naturalFriction)
            );

            this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.naturalRotateSpeed);
            this.sphericalDelta.theta -= (2 * Math.PI * this.rotateDelta.x) / this.renderer.domElement.clientHeight;
            this.sphericalDelta.phi -= (2 * Math.PI * this.rotateDelta.y) / this.renderer.domElement.clientHeight;
            this.rotateStart.copy(this.rotateEnd);

            let offset = new THREE.Vector3();
            let quat = new THREE.Quaternion().setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
            let quatInverse = quat.clone().inverse();

            offset.copy(this.camera.position).sub(this.target);
            offset.applyQuaternion(quat);

            this.spherical.setFromVector3(offset);
            this.spherical.theta += this.sphericalDelta.theta;
            this.spherical.phi += this.sphericalDelta.phi;
            this.spherical.makeSafe();
            this.spherical.radius *= 1.0;

            offset.setFromSpherical(this.spherical);
            offset.applyQuaternion(quatInverse);
            this.camera.position.copy(this.target).add(offset);

            this.camera.lookAt(this.target);
            this.sphericalDelta.set(0, 0, 0);
        }
        if (this.phoneObject && this.baseRotation) {
            this.phoneObject.rotation.x = this.logFn(
                this.phoneObject.rotation.x,
                this.baseRotation.x,
                this.baseRotationFriction,
                0.00001
            );
            this.phoneObject.rotation.y = this.logFn(
                this.phoneObject.rotation.y,
                this.baseRotation.y,
                this.baseRotationFriction,
                0.00001
            );
            this.phoneObject.rotation.z = this.logFn(
                this.phoneObject.rotation.z,
                this.baseRotation.z,
                this.baseRotationFriction,
                0.00001
            );
        }
        if (this.zoomDestination) {
            this.camera.position.z = this.logFn(this.camera.position.z, this.zoomDestination, this.zoomFriction, 0.1);
        }
        if (this.textureDestination) {
            this.screenObject.material.map.offset.x = this.logFn(
                this.screenObject.material.map.offset.x,
                this.textureDestination.x,
                this.textureFriction,
                0.001
            );
            if (
                this.screenObject.material.map.offset.x <= 0.001 ||
                this.textureDestination.y >= this.screenObject.material.map.offset.y
            ) {
                this.screenObject.material.map.offset.y = this.logFn(
                    this.screenObject.material.map.offset.y,
                    this.textureDestination.y,
                    this.textureFriction,
                    0.001
                );
            }
        }
    }

    updateBaseRotation(x, y, z) {
        this.baseRotation = new THREE.Vector3((x * Math.PI) / 180, (y * Math.PI) / 180, (z * Math.PI) / 180);
    }

    toggleNaturalRotation(enabled) {
        this.naturalRotationEnabled = enabled;
        if (!this.naturalRotationEnabled) {
            this.naturalDestination = { x: window.innerWidth / 2.0, y: window.innerHeight / 2.0 };
        }
    }

    updateZoomPercentage(percentage) {
        this.zoomDestination = this.defaultCameraZ / (1.0 + percentage);
    }

    updateTexture(x, y) {
        this.textureDestination.x = x;
        this.textureDestination.y = y;
    }

    forward(duration = 600, delay = 0) {
        if (this.isForward) return;
        this.isForward = true;
        setTimeout(() => {
            this.domContainer.style.transition = `all ease-out ${duration}ms`;
            this.domContainer.style.transform = 'scale(1.0)';
        }, delay);
    }

    backward(duration = 600, delay = 0) {
        if (!this.isForward) return;
        this.isForward = false;
        setTimeout(() => {
            this.domContainer.style.transition = `all ease-out ${duration}ms`;
            this.domContainer.style.transform = 'scale(1.0)';
        }, delay);
    }

    render() {
        return <div className="phone-3d-container" ref={ref => (this.domContainer = ref)}></div>;
    }
}

export default Phone3D;
