const express = require('express');
const app = express();
const port = process.env.PORT || 80; // Usamos variable de entorno o puerto 80 por defecto

// Middleware para parsear el body de las peticiones a JSON
app.use(express.json());

// ==========================================
// ALMACENAMIENTO EN MEMORIA
// ==========================================
let alumnos = [];
let profesores = [];
let alumnoIdCounter = 1;
let profesorIdCounter = 1;

// ==========================================
// FUNCIONES DE VALIDACIÓN
// ==========================================

// Valida la entidad Alumno (nombres, apellidos, matricula, promedio)
const validarAlumno = (data) => {
    const { nombres, apellidos, matricula, promedio } = data;
    if (!nombres || typeof nombres !== 'string' || nombres.trim() === '') return false;
    if (!apellidos || typeof apellidos !== 'string' || apellidos.trim() === '') return false;
    if (!matricula || typeof matricula !== 'string' || matricula.trim() === '') return false;
    if (promedio === undefined || typeof promedio !== 'number') return false;
    return true;
};

// Valida la entidad Profesor (numeroEmpleado, nombres, apellidos, horasClase)
const validarProfesor = (data) => {
    const { numeroEmpleado, nombres, apellidos, horasClase } = data;
    if (numeroEmpleado === undefined || typeof numeroEmpleado !== 'number') return false;
    if (!nombres || typeof nombres !== 'string' || nombres.trim() === '') return false;
    if (!apellidos || typeof apellidos !== 'string' || apellidos.trim() === '') return false;
    if (horasClase === undefined || typeof horasClase !== 'number') return false;
    return true;
};

// ==========================================
// ENDPOINTS DE ALUMNOS
// ==========================================

// GET /alumnos
app.get('/alumnos', (req, res) => {
    try {
        res.status(200).json(alumnos);
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// GET /alumnos/{id}
app.get('/alumnos/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const alumno = alumnos.find(a => a.id === id);

        if (alumno) {
            res.status(200).json(alumno);
        } else {
            res.status(404).json({ error: "Alumno no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// POST /alumnos
app.post('/alumnos', (req, res) => {
    try {
        if (!validarAlumno(req.body)) {
            // Retornamos 400 (Bad Request) si la validación falla
            return res.status(400).json({ error: "Datos de alumno inválidos. Verifique campos vacíos o tipos de datos." });
        }

        const nuevoAlumno = {
            id: req.body.id !== undefined ? req.body.id : alumnoIdCounter++,
            nombres: req.body.nombres,
            apellidos: req.body.apellidos,
            matricula: req.body.matricula,
            promedio: req.body.promedio
        };

        alumnos.push(nuevoAlumno);
        res.status(201).json(nuevoAlumno);
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Manejador para métodos no permitidos en /alumnos (Para pasar la prueba testUnsuportedMethod)
app.all('/alumnos', (req, res) => {
    res.status(405).json({ error: "Método no permitido" });
});

// PUT /alumnos/{id}
app.put('/alumnos/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const index = alumnos.findIndex(a => a.id === id);

        if (index === -1) {
            return res.status(404).json({ error: "Alumno no encontrado" });
        }

        if (!validarAlumno(req.body)) {
            return res.status(400).json({ error: "Datos de alumno inválidos." });
        }

        alumnos[index] = {
            id: id,
            nombres: req.body.nombres,
            apellidos: req.body.apellidos,
            matricula: req.body.matricula,
            promedio: req.body.promedio
        };

        res.status(200).json(alumnos[index]);
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// DELETE /alumnos/{id}
app.delete('/alumnos/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const index = alumnos.findIndex(a => a.id === id);

        if (index === -1) {
            return res.status(404).json({ error: "Alumno no encontrado" });
        }

        alumnos.splice(index, 1);
        res.status(200).json({ mensaje: "Alumno eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ==========================================
// ENDPOINTS DE PROFESORES
// ==========================================

// GET /profesores
app.get('/profesores', (req, res) => {
    try {
        res.status(200).json(profesores);
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// GET /profesores/{id}
app.get('/profesores/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const profesor = profesores.find(p => p.id === id);

        if (profesor) {
            res.status(200).json(profesor);
        } else {
            res.status(404).json({ error: "Profesor no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// POST /profesores
app.post('/profesores', (req, res) => {
    try {
        if (!validarProfesor(req.body)) {
            return res.status(400).json({ error: "Datos de profesor inválidos. Verifique campos vacíos o tipos de datos." });
        }

        const nuevoProfesor = {
            id: req.body.id !== undefined ? req.body.id : profesorIdCounter++,
            numeroEmpleado: req.body.numeroEmpleado,
            nombres: req.body.nombres,
            apellidos: req.body.apellidos,
            horasClase: req.body.horasClase
        };

        profesores.push(nuevoProfesor);
        res.status(201).json(nuevoProfesor);
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Manejador para métodos no permitidos en /profesores (Para pasar la prueba testUnsuportedMethod)
app.all('/profesores', (req, res) => {
    res.status(405).json({ error: "Método no permitido" });
});

// PUT /profesores/{id}
app.put('/profesores/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const index = profesores.findIndex(p => p.id === id);

        if (index === -1) {
            return res.status(404).json({ error: "Profesor no encontrado" });
        }

        if (!validarProfesor(req.body)) {
            return res.status(400).json({ error: "Datos de profesor inválidos." });
        }

        profesores[index] = {
            id: id,
            numeroEmpleado: req.body.numeroEmpleado,
            nombres: req.body.nombres,
            apellidos: req.body.apellidos,
            horasClase: req.body.horasClase
        };

        res.status(200).json(profesores[index]);
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// DELETE /profesores/{id}
app.delete('/profesores/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const index = profesores.findIndex(p => p.id === id);

        if (index === -1) {
            return res.status(404).json({ error: "Profesor no encontrado" });
        }

        profesores.splice(index, 1);
        res.status(200).json({ mensaje: "Profesor eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
app.listen(port, () => {
    console.log(`API REST corriendo en el puerto ${port}`);
});