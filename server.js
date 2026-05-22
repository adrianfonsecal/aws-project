const express = require('express');
require('dotenv').config();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Sequelize, DataTypes } = require('sequelize');

// Nuevas importaciones para Fase 3 (SNS, DynamoDB y Crypto)
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const fs = require('fs'); // Añadido para leer archivos del disco duro

const app = express();
const port = process.env.PORT || 80;

app.use(express.json());

// ==========================================
// CONFIGURACIÓN DE AWS (CREDENTIALS)
// ==========================================
const awsConfig = {
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
    }
};

// Clientes de AWS SDK v3
const s3 = new S3Client(awsConfig);
const snsClient = new SNSClient(awsConfig);

const ddbClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

// CAMBIO AQUÍ: Usamos el disco duro en lugar de la memoria RAM
const upload = multer({ dest: '/tmp/uploads/' });

// ==========================================
// CONFIGURACIÓN DE SEQUELIZE (RDS)
// ==========================================
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false
    }
);

const Alumno = sequelize.define('Alumno', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombres: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },
    matricula: { type: DataTypes.STRING, allowNull: false },
    promedio: { type: DataTypes.FLOAT, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    fotoPerfilUrl: { type: DataTypes.STRING, allowNull: true }
}, { timestamps: false });

const Profesor = sequelize.define('Profesor', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    numeroEmpleado: { type: DataTypes.INTEGER, allowNull: false },
    nombres: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },
    horasClase: { type: DataTypes.INTEGER, allowNull: false }
}, { timestamps: false });

sequelize.sync().then(() => {
    console.log("Tablas sincronizadas con la base de datos RDS MySQL.");
}).catch(err => console.error("Error conectando a RDS:", err));

// ==========================================
// VALIDACIONES
// ==========================================
const validarAlumno = (data) => {
    const { nombres, apellidos, matricula, promedio, password } = data;
    if (!nombres || typeof nombres !== 'string' || nombres.trim() === '') return false;
    if (!apellidos || typeof apellidos !== 'string' || apellidos.trim() === '') return false;
    if (!matricula || typeof matricula !== 'string' || matricula.trim() === '') return false;
    if (promedio === undefined || typeof promedio !== 'number') return false;
    if (!password || typeof password !== 'string' || password.trim() === '') return false;
    return true;
};

const validarProfesor = (data) => {
    const { numeroEmpleado, nombres, apellidos, horasClase } = data;
    if (numeroEmpleado === undefined || typeof numeroEmpleado !== 'number') return false;
    if (!nombres || typeof nombres !== 'string' || nombres.trim() === '') return false;
    if (!apellidos || typeof apellidos !== 'string' || apellidos.trim() === '') return false;
    if (horasClase === undefined || typeof horasClase !== 'number') return false;
    return true;
};

// ==========================================
// ENDPOINTS: ALUMNOS
// ==========================================
app.get('/alumnos', async (req, res) => {
    try {
        const alumnos = await Alumno.findAll();
        res.status(200).json(alumnos);
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.get('/alumnos/:id', async (req, res) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (alumno) res.status(200).json(alumno);
        else res.status(404).json({ error: "Alumno no encontrado" });
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.post('/alumnos', async (req, res) => {
    try {
        if (!validarAlumno(req.body)) return res.status(400).json({ error: "Datos de alumno inválidos." });
        const nuevoAlumno = await Alumno.create(req.body);
        res.status(201).json(nuevoAlumno);
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.put('/alumnos/:id', async (req, res) => {
    try {
        if (!validarAlumno(req.body)) return res.status(400).json({ error: "Datos de alumno inválidos." });
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });
        await alumno.update({
            nombres: req.body.nombres, apellidos: req.body.apellidos,
            matricula: req.body.matricula, promedio: req.body.promedio, password: req.body.password
        });
        res.status(200).json(alumno);
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.delete('/alumnos/:id', async (req, res) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });
        await alumno.destroy();
        res.status(200).json({ mensaje: "Alumno eliminado correctamente" });
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.all('/alumnos', (req, res) => { res.status(405).json({ error: "Método no permitido" }); });

// ==========================================
// ENDPOINT: S3 SUBIR FOTO
// ==========================================
// Añadimos un punto de control antes de que multer procese el archivo
app.post('/alumnos/:id/fotoPerfil', (req, res, next) => {
    console.log(`\n--- Petición recibida en /alumnos/${req.params.id}/fotoPerfil ---`);
    next();
}, (req, res) => {
    upload.single('foto')(req, res, async (err) => {
        if (err) {
            console.error("⚠️ Error interno de Multer:", err);
            return res.status(400).json({ error: "Error al leer el archivo. Verifica el formato." });
        }

        try {
            console.log(`➡️ 1. Iniciando subida de foto para alumno ID: ${req.params.id}`);

            const alumno = await Alumno.findByPk(req.params.id);
            if (!alumno) {
                console.log("❌ Alumno no encontrado");
                return res.status(404).json({ error: "Alumno no encontrado" });
            }

            if (!req.file) {
                console.log("❌ No se encontró el archivo en la petición");
                return res.status(400).json({ error: "No se proporcionó ninguna imagen." });
            }

            console.log(`✅ 2. Archivo guardado temporalmente en disco: ${req.file.path}`);

            // Leemos el archivo desde el disco
            const fileStream = fs.createReadStream(req.file.path);
            const fileKey = `perfiles/alumno_${alumno.id}_${Date.now()}_${req.file.originalname}`;

            const command = new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: fileKey,
                Body: fileStream,
                ContentType: req.file.mimetype,
                ACL: 'public-read'
            });

            console.log("☁️ 3. Enviando comando a Amazon S3...");
            await s3.send(command);
            console.log("✅ 4. S3 respondió correctamente (Foto guardada)");

            // Borramos el archivo temporal del disco para no llenar la instancia
            fs.unlinkSync(req.file.path);

            const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileKey}`;

            alumno.fotoPerfilUrl = fileUrl;
            await alumno.save();

            console.log("✅ 5. Base de datos actualizada");
            res.status(200).json({ mensaje: "Foto subida", fotoPerfilUrl: fileUrl, alumno });
        } catch (error) {
            console.error("⚠️ DETALLE DEL ERROR DE S3:", error);
            res.status(500).json({ error: "Error interno al procesar imagen" });
        }
    });
});

// ==========================================
// NUEVO ENDPOINT: SNS EMAIL
// ==========================================
app.post('/alumnos/:id/email', async (req, res) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        const mensaje = `Hola, este es un mensaje automático de SICEI.\n\nDatos del alumno:\nNombre: ${alumno.nombres} ${alumno.apellidos}\nPromedio: ${alumno.promedio}`;

        const command = new PublishCommand({
            TopicArn: process.env.AWS_SNS_TOPIC_ARN,
            Message: mensaje,
            Subject: `Calificaciones de ${alumno.nombres}`
        });

        await snsClient.send(command);
        res.status(200).json({ mensaje: "Correo enviado correctamente a los suscriptores." });
    } catch (error) {
        console.error("Error al enviar email:", error);
        res.status(500).json({ error: "Error al enviar el correo" });
    }
});

// ==========================================
// NUEVOS ENDPOINTS: DYNAMODB (SESIONES)
// ==========================================

// 1. LOGIN
app.post('/alumnos/:id/session/login', async (req, res) => {
    try {
        const { password } = req.body;
        const alumnoId = parseInt(req.params.id);
        const alumno = await Alumno.findByPk(alumnoId);

        // Verificamos si existe y si la contraseña es correcta
        if (!alumno || alumno.password !== password) {
            return res.status(400).json({ error: "Credenciales inválidas" });
        }

        // Generamos los datos requeridos
        const id = crypto.randomUUID(); // string (UUID)
        const fecha = Date.now(); // number (Unix timestamp en ms)
        const active = true; // boolean
        const sessionString = crypto.randomBytes(64).toString('hex'); // string (128 dígitos hex)

        const params = {
            TableName: "sesiones-alumnos",
            Item: { id, fecha, alumnoId, active, sessionString }
        };

        await docClient.send(new PutCommand(params));

        res.status(200).json({ sessionString });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: "Error interno al iniciar sesión" });
    }
});

// 2. VERIFY
app.post('/alumnos/:id/session/verify', async (req, res) => {
    try {
        const { sessionString } = req.body;
        const alumnoId = parseInt(req.params.id);

        // Buscamos la sesión usando un Scan (Ideal para pruebas pequeñas como este laboratorio)
        const params = {
            TableName: "sesiones-alumnos",
            FilterExpression: "sessionString = :s AND alumnoId = :aid",
            ExpressionAttributeValues: { ":s": sessionString, ":aid": alumnoId }
        };

        const result = await docClient.send(new ScanCommand(params));

        // Si la encontramos y está activa, regresamos 200
        if (result.Items.length > 0 && result.Items[0].active === true) {
            return res.status(200).json({ mensaje: "Sesión válida" });
        } else {
            return res.status(400).json({ error: "Sesión inválida o inactiva" });
        }
    } catch (error) {
        console.error("Error en verify:", error);
        res.status(500).json({ error: "Error al verificar sesión" });
    }
});

// 3. LOGOUT
app.post('/alumnos/:id/session/logout', async (req, res) => {
    try {
        const { sessionString } = req.body;

        // Primero necesitamos encontrar el ID (UUID) de la sesión con ese sessionString
        const scanParams = {
            TableName: "sesiones-alumnos",
            FilterExpression: "sessionString = :s",
            ExpressionAttributeValues: { ":s": sessionString }
        };

        const result = await docClient.send(new ScanCommand(scanParams));

        if (result.Items.length === 0) {
            return res.status(400).json({ error: "Sesión no encontrada" });
        }

        const sessionId = result.Items[0].id; // El UUID original

        // Actualizamos el campo 'active' a false
        const updateParams = {
            TableName: "sesiones-alumnos",
            Key: { id: sessionId },
            UpdateExpression: "set active = :status",
            ExpressionAttributeValues: { ":status": false }
        };

        await docClient.send(new UpdateCommand(updateParams));

        res.status(200).json({ mensaje: "Logout exitoso, sesión terminada" });
    } catch (error) {
        console.error("Error en logout:", error);
        res.status(500).json({ error: "Error al cerrar sesión" });
    }
});

// ==========================================
// ENDPOINTS: PROFESORES
// ==========================================
app.get('/profesores', async (req, res) => {
    try {
        const profesores = await Profesor.findAll();
        res.status(200).json(profesores);
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.get('/profesores/:id', async (req, res) => {
    try {
        const profesor = await Profesor.findByPk(req.params.id);
        if (profesor) res.status(200).json(profesor);
        else res.status(404).json({ error: "Profesor no encontrado" });
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.post('/profesores', async (req, res) => {
    try {
        if (!validarProfesor(req.body)) return res.status(400).json({ error: "Datos inválidos." });
        const nuevoProfesor = await Profesor.create(req.body);
        res.status(201).json(nuevoProfesor);
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.put('/profesores/:id', async (req, res) => {
    try {
        if (!validarProfesor(req.body)) return res.status(400).json({ error: "Datos inválidos." });
        const profesor = await Profesor.findByPk(req.params.id);
        if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });
        await profesor.update({
            numeroEmpleado: req.body.numeroEmpleado, nombres: req.body.nombres,
            apellidos: req.body.apellidos, horasClase: req.body.horasClase
        });
        res.status(200).json(profesor);
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.delete('/profesores/:id', async (req, res) => {
    try {
        const profesor = await Profesor.findByPk(req.params.id);
        if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });
        await profesor.destroy();
        res.status(200).json({ mensaje: "Eliminado correctamente" });
    } catch (error) { res.status(500).json({ error: "Error interno del servidor" }); }
});

app.all('/profesores', (req, res) => { res.status(405).json({ error: "Método no permitido" }); });

// ==========================================
// INICIO
// ==========================================
app.listen(port, () => {
    console.log(`API REST corriendo en el puerto ${port}`);
});