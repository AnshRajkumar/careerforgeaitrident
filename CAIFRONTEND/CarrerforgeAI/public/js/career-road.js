// CareerForge AI — Pure Three.js 3D Animated Road Scene
// A futuristic, neon-lit career path with moving vehicles and students.

(function() {
    const canvas = document.getElementById('careerCanvas');
    if (!canvas) return;

    // ---- THREE.JS BASIC SETUP ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060f); // Dark space background

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    // Fixed isometric-like perspective looking toward the right
    camera.position.set(-15, 25, 45);
    camera.lookAt(10, 5, -5);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ---- LIGHTS ----
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x818cf8, 1.2);
    dirLight.position.set(10, 30, 10);
    scene.add(dirLight);

    // ---- ROAD PATH (CatmullRomCurve3) ----
    const roadPoints = [
        new THREE.Vector3(0, 0, 30),
        new THREE.Vector3(10, 2, 15),
        new THREE.Vector3(5, 4, 0),
        new THREE.Vector3(15, 6, -15),
        new THREE.Vector3(10, 8, -30),
        new THREE.Vector3(20, 10, -45)
    ];
    const roadCurve = new THREE.CatmullRomCurve3(roadPoints);

    // ---- ROAD GEOMETRY (Extruded flat road) ----
    const roadWidth = 3;
    const roadShape = new THREE.Shape();
    roadShape.moveTo(-roadWidth/2, -0.1);
    roadShape.lineTo(roadWidth/2, -0.1);
    roadShape.lineTo(roadWidth/2, 0.1);
    roadShape.lineTo(-roadWidth/2, 0.1);
    roadShape.lineTo(-roadWidth/2, -0.1);

    const extrudeSettings = {
        steps: 100,
        bevelEnabled: false,
        extrudePath: roadCurve
    };
    const roadGeo = new THREE.ExtrudeGeometry(roadShape, extrudeSettings);
    const roadMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        emissive: 0x0a0a1a,
        roughness: 0.5,
        metalness: 0.3
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    scene.add(roadMesh);

    // ---- GLOWING EDGES ----
    function createEdge(side) {
        const edgePoints = [];
        const divisions = 100;
        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions;
            const point = roadCurve.getPoint(t);
            const tangent = roadCurve.getTangent(t).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const sideVec = new THREE.Vector3().crossVectors(tangent, up).normalize();
            point.add(sideVec.multiplyScalar(side * (roadWidth / 2 + 0.05)));
            edgePoints.push(point);
        }
        const edgeCurve = new THREE.CatmullRomCurve3(edgePoints);
        const edgeGeo = new THREE.TubeGeometry(edgeCurve, 100, 0.08, 8, false);
        const edgeMat = new THREE.MeshStandardMaterial({
            color: side > 0 ? 0x6366f1 : 0x8b5cf6, // Purple-ish or Blue-ish
            emissive: side > 0 ? 0x6366f1 : 0x8b5cf6,
            emissiveIntensity: 2
        });
        return new THREE.Mesh(edgeGeo, edgeMat);
    }
    scene.add(createEdge(1));
    scene.add(createEdge(-1));

    // ---- DASHED CENTER LINE ----
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
    for (let i = 0; i < 50; i++) {
        const t1 = i / 50;
        const t2 = (i + 0.3) / 50;
        const p1 = roadCurve.getPoint(t1);
        const p2 = roadCurve.getPoint(t2);
        const dashGeo = new THREE.BoxGeometry(0.1, 0.02, 0.5);
        const dash = new THREE.Mesh(dashGeo, lineMat);
        dash.position.copy(p1.lerp(p2, 0.5));
        dash.position.y += 0.15;
        dash.lookAt(p2);
        scene.add(dash);
    }

    // ---- VEHICLES (3-4 Glowing Boxes) ----
    const vehicles = [];
    const carColors = [0x6366f1, 0x22d3ee, 0xf472b6, 0x10b981];
    for (let i = 0; i < 4; i++) {
        const group = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(1, 0.5, 1.5);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: carColors[i],
            emissive: carColors[i],
            emissiveIntensity: 1.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Headlights
        const hLightGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const hLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const h1 = new THREE.Mesh(hLightGeo, hLightMat);
        h1.position.set(0.35, 0, -0.75);
        group.add(h1);
        const h2 = new THREE.Mesh(hLightGeo, hLightMat);
        h2.position.set(-0.35, 0, -0.75);
        group.add(h2);

        scene.add(group);
        vehicles.push({ mesh: group, t: i / 4, speed: 0.0012 });
    }

    // ---- STUDENTS (Cylinder + Sphere + Book) ----
    const students = [];
    for (let i = 0; i < 6; i++) {
        const group = new THREE.Group();
        // Body
        const bGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8);
        const bMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, emissive: 0x332211 });
        group.add(new THREE.Mesh(bGeo, bMat));
        // Head
        const hGeo = new THREE.SphereGeometry(0.18, 12, 12);
        const head = new THREE.Mesh(hGeo, bMat);
        head.position.y = 0.45;
        group.add(head);
        // Book (Small cube on back)
        const bookGeo = new THREE.BoxGeometry(0.25, 0.35, 0.1);
        const bookMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x221166 });
        const book = new THREE.Mesh(bookGeo, bookMat);
        book.position.set(0, 0.1, 0.2);
        group.add(book);

        scene.add(group);
        students.push({
            mesh: group,
            t: i / 6 + Math.random() * 0.1,
            speed: 0.0004,
            side: (i % 2 === 0 ? 1 : -1) * 0.8
        });
    }

    // ---- ANIMATION LOOP ----
    function animate() {
        requestAnimationFrame(animate);

        // Move Vehicles
        vehicles.forEach(v => {
            v.t = (v.t + v.speed) % 1;
            const pos = roadCurve.getPoint(v.t);
            const next = roadCurve.getPoint((v.t + 0.01) % 1);
            v.mesh.position.copy(pos);
            v.mesh.position.y += 0.4;
            v.mesh.lookAt(next);
        });

        // Move Students
        students.forEach(s => {
            s.t = (s.t + s.speed) % 1;
            const pos = roadCurve.getPoint(s.t);
            const next = roadCurve.getPoint((s.t + 0.01) % 1);
            const tangent = roadCurve.getTangent(s.t).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

            s.mesh.position.copy(pos);
            s.mesh.position.add(side.multiplyScalar(s.side));
            s.mesh.position.y += 0.45;
            s.mesh.lookAt(next);

            // Subtle bounce
            s.mesh.position.y += Math.sin(Date.now() * 0.005 + s.t * 100) * 0.05;
        });

        renderer.render(scene, camera);
    }

    // ---- WINDOW RESIZE ----
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
})();
