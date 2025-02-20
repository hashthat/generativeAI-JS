import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import 'babylonjs-materials';

class MechanicalVRExperience {
    private canvas: HTMLCanvasElement;
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene;
    private xrHelper: BABYLON.WebXRDefaultExperience;
    private materials: Map<string, BABYLON.Material>;
    private particleSystems: Map<string, BABYLON.ParticleSystem>;

    // Color palette matching the UI
    private readonly COLORS = {
        primaryDark: new BABYLON.Color3(0.15, 0.15, 0.17),
        metallic: new BABYLON.Color3(0.82, 0.78, 0.73),
        accent: new BABYLON.Color3(0.35, 0.35, 0.38)
    };

    constructor() {
        this.canvas = document.createElement('canvas');
        document.body.appendChild(this.canvas);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.materials = new Map();
        this.particleSystems = new Map();
    }

    async initialize(): Promise<void> {
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.15, 0.15, 0.17, 1);

        // Setup camera and lights
        const camera = new BABYLON.FreeCamera('mainCamera', new BABYLON.Vector3(0, 1.7, -3), this.scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        
        const hemisphericLight = new BABYLON.HemisphericLight(
            'mainLight',
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        hemisphericLight.intensity = 0.7;

        // Add spotlights for dramatic lighting
        this.createSpotlights();

        // Initialize materials
        this.createMaterials();

        // Create environment
        await this.createEnvironment();

        // Setup VR
        await this.setupVR();

        // Start render loop
        this.engine.runRenderLoop(() => this.scene.render());
        window.addEventListener('resize', () => this.engine.resize());
    }

    private async setupVR(): Promise<void> {
        try {
            this.xrHelper = await BABYLON.WebXRDefaultExperience.CreateAsync(this.scene, {
                floorMeshes: [this.scene.getMeshByName('ground')],
                optionalFeatures: true
            });

            // Setup VR controllers
            this.xrHelper.input.onControllerAddedObservable.add((controller) => {
                controller.onMotionControllerInitObservable.add((motionController) => {
                    motionController.onModelLoadedObservable.add((controller) => {
                        this.setupControllerInteractions(controller);
                    });
                });
            });
        } catch (err) {
            console.log('WebXR not available');
        }
    }

    private createMaterials(): void {
        // Create PBR material for metallic surfaces
        const metallicMaterial = new BABYLON.PBRMaterial('metallic', this.scene);
        metallicMaterial.metallic = 0.8;
        metallicMaterial.roughness = 0.3;
        metallicMaterial.albedoColor = this.COLORS.metallic;
        this.materials.set('metallic', metallicMaterial);

        // Create emissive material for interactive elements
        const emissiveMaterial = new BABYLON.StandardMaterial('emissive', this.scene);
        emissiveMaterial.emissiveColor = this.COLORS.accent;
        this.materials.set('emissive', emissiveMaterial);

        // Create custom shader material for geometric patterns
        const geometricMaterial = new BABYLON.ShaderMaterial(
            'geometric',
            this.scene,
            {
                vertex: 'geometric',
                fragment: 'geometric',
            },
            {
                attributes: ['position', 'normal', 'uv'],
                uniforms: ['world', 'worldView', 'worldViewProjection', 'time'],
                samplers: ['textureSampler']
            }
        );
        this.materials.set('geometric', geometricMaterial);
    }

    private async createEnvironment(): Promise<void> {
        // Create ground
        const ground = BABYLON.MeshBuilder.CreateGround('ground', {
            width: 20,
            height: 20,
            subdivisions: 20
        }, this.scene);
        ground.material = this.materials.get('metallic');

        // Create mechanical elements
        await this.createMechanicalElements();

        // Create radar display
        this.createRadarDisplay();

        // Create control panel
        this.createControlPanel();

        // Setup particle systems
        this.setupParticleSystems();
    }

    private async createMechanicalElements(): Promise<void> {
        const radius = 5;
        const count = 8;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const mechanical = BABYLON.MeshBuilder.CreateCylinder(
                `mechanical${i}`,
                { height: 0.5, diameter: 1 },
                this.scene
            );
            mechanical.position = new BABYLON.Vector3(x, 1.5, z);
            mechanical.material = this.materials.get('metallic');

            // Add animation
            const animation = new BABYLON.Animation(
                `mechanicalAnim${i}`,
                'rotation.y',
                30,
                BABYLON.Animation.ANIMATIONTYPE_FLOAT,
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
            );

            const keys = [];
            keys.push({ frame: 0, value: 0 });
            keys.push({ frame: 100, value: Math.PI * 2 });
            animation.setKeys(keys);

            mechanical.animations = [animation];
            this.scene.beginAnimation(mechanical, 0, 100, true);

            // Make interactive
            mechanical.actionManager = new BABYLON.ActionManager(this.scene);
            mechanical.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPickTrigger,
                    () => this.onMechanicalElementActivated(mechanical)
                )
            );
        }
    }

    private createRadarDisplay(): void {
        const radar = BABYLON.MeshBuilder.CreateDisc('radar', { radius: 2 }, this.scene);
        radar.position = new BABYLON.Vector3(0, 3, 0);
        radar.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);

        // Create radar sweep effect
        const radarMaterial = new BABYLON.StandardMaterial('radarMat', this.scene);
        radarMaterial.emissiveColor = this.COLORS.accent;
        radar.material = radarMaterial;

        // Animate radar sweep
        this.scene.registerBeforeRender(() => {
            radar.rotation.y += 0.01;
        });
    }

    private createControlPanel(): void {
        const panel = BABYLON.MeshBuilder.CreateBox('panel', {
            width: 2,
            height: 1,
            depth: 0.1
        }, this.scene);
        panel.position = new BABYLON.Vector3(0, 1.2, -1);
        panel.material = this.materials.get('metallic');

        // Add interactive buttons
        this.createControlButtons(panel);
    }

    private createControlButtons(panel: BABYLON.Mesh): void {
        const buttonPositions = [
            [-0.7, 0.2], [-0.35, 0.2], [0, 0.2], [0.35, 0.2], [0.7, 0.2],
            [-0.7, -0.2], [-0.35, -0.2], [0, -0.2], [0.35, -0.2], [0.7, -0.2]
        ];

        buttonPositions.forEach((pos, index) => {
            const button = BABYLON.MeshBuilder.CreateCylinder(
                `button${index}`,
                { height: 0.05, diameter: 0.15 },
                this.scene
            );
            button.parent = panel;
            button.position = new BABYLON.Vector3(pos[0], pos[1], 0.1);
            button.material = this.materials.get('emissive');

            // Make button interactive
            button.actionManager = new BABYLON.ActionManager(this.scene);
            button.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPickTrigger,
                    () => this.onButtonPressed(button)
                )
            );
        });
    }

    private setupParticleSystems(): void {
        const particleSystem = new BABYLON.ParticleSystem('particles', 2000, this.scene);
        particleSystem.particleTexture = new BABYLON.Texture('path/to/particle.png', this.scene);
        particleSystem.emitter = new BABYLON.Vector3(0, 1, 0);
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);
        particleSystem.color1 = this.COLORS.metallic;
        particleSystem.color2 = this.COLORS.accent;
        particleSystem.colorDead = this.COLORS.primaryDark;
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.3;
        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 1.5;
        particleSystem.emitRate = 100;
        
        this.particleSystems.set('main', particleSystem);
    }

    private setupControllerInteractions(controller: BABYLON.WebXRInputSource): void {
        controller.onTriggerStateChangedObservable.add((eventData) => {
            if (eventData.pressed) {
                const ray = controller.getWorldPointerRayToRef(new BABYLON.Ray());
                const pick = this.scene.pickWithRay(ray);
                
                if (pick.hit && pick.pickedMesh) {
                    this.onControllerInteraction(pick.pickedMesh);
                }
            }
        });
    }

    private onMechanicalElementActivated(mesh: BABYLON.Mesh): void {
        // Trigger particle effect
        const particleSystem = this.particleSystems.get('main');
        particleSystem.emitter = mesh.position;
        particleSystem.start();

        // Play sound
        const sound = new BABYLON.Sound(
            'mechanical',
            'path/to/mechanical-sound.mp3',
            this.scene,
            null,
            { spatialSound: true }
        );
        sound.attachToMesh(mesh);
        sound.play();

        // Animate mesh
        mesh.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
        setTimeout(() => {
            mesh.scaling = new BABYLON.Vector3(1, 1, 1);
        }, 200);
    }

    private onButtonPressed(button: BABYLON.Mesh): void {
        button.position.z -= 0.02;
        setTimeout(() => {
            button.position.z += 0.02;
        }, 100);

        // Trigger associated effect
        this.onMechanicalElementActivated(button);
    }

    private createSpotlights(): void {
        const positions = [
            new BABYLON.Vector3(5, 5, 5),
            new BABYLON.Vector3(-5, 5, 5),
            new BABYLON.Vector3(5, 5, -5),
            new BABYLON.Vector3(-5, 5, -5)
        ];

        positions.forEach((pos, index) => {
            const spotlight = new BABYLON.SpotLight(
                `spotlight${index}`,
                pos,
                new BABYLON.Vector3(0, -1, 0),
                Math.PI / 3,
                2,
                this.scene
            );
            spotlight.intensity = 0.5;
            spotlight.diffuse = this.COLORS.metallic;
        });
    }
}

// Initialize the experience
const experience = new MechanicalVRExperience();
experience.initialize();
