const express = require('express');
const app = express();
const port = 8080;

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: ''
});

// const bucket = admin.storage().bucket();

const db = admin.firestore();
// const storage = admin.getStorage();

app.use(express.json());

//CUSTOM CLAIM
admin.auth().setCustomUserClaims('a0MqMps0ujZX5v9t9L6UWvKNTNv2', { admin: true })
.then(() => {
    console.log('Custom claim added to admin successfully');
})
.catch((error) => {
    console.log(error);
});

// MIDDLEWARE
const authTokenVerify = async (req, res, next) => {
    const { authtoken } = req.headers;
    const { authid } = req.headers;

    try {
        const authUsers = await admin.auth().verifyIdToken(authtoken);
        if(authUsers.uid !== authid){
            return res.sendStatus(403);
        } 
    } catch(e){
        return res.sendStatus(401);
    }
    next();
};

// LOGIN
app.get('/api/set/users', async (req, res) => {
    const { authtoken } = req.headers;
    await admin.auth().verifyIdToken(authtoken).then((claims) => {
        if(claims.admin === true) {
            res.sendStatus(200);
            console.log(claims.admin)
        }
        else{
            res.sendStatus(404);
            console.log("failed")
        }
    });

});

app.get('/api/read/users', authTokenVerify, async (req, res) => {
    const docRef = db.collection('employees');
    const response = await docRef.get();
    let responseArr = [];
    
    response.forEach(doc => {
        responseArr.push({id: doc.id,...doc.data()});
    });
    res.send(responseArr);
});

app.post('/api/create/users', authTokenVerify, async (req, res) => {
    const userInfo = {
        firstName: req.body.firstName,
        middleName: req.body.middleName,
        lastName: req.body.lastName,
        address: req.body.address,
        city: req.body.city,
        email: req.body.email,
        password: req.body.password,
        phone: req.body.phone,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }

    await admin.auth().createUser({
        email: userInfo.email,
        emailVerified: true,
        password: userInfo.password,
    })
    .then((userRecord) => {
        db.collection('employees').doc(userRecord.uid).set(userInfo);
        res.sendStatus(200);
    })
    .catch((e) => {
        res.status(400).send(e.message);
    });
});

app.put('/api/update/users/:userId', authTokenVerify, async (req, res) => {
    const { userId } = req.params;
    
    const userJson = {
        firstName: req.body.firstName,
        middleName: req.body.middleName,
        lastName: req.body.lastName,
        address: req.body.address,
        city: req.body.city,
        email: req.body.email,
        phone: req.body.phone
    };

    if(userId){
        admin.auth().updateUser(userId,{
            email: userJson.email,
            emailVerified: true
        }).then((userRecord) => {
            const docRef = db.collection('employees').doc(userId).update(userJson);
            res.status(200).send(docRef);
        }).catch((e) => {
            res.status(400).send(e.message);
        });
    } else {
        res.sendStatus(404);
    }
});
app.put('/api/update/profile/:userId', authTokenVerify, async (req, res) => {
    const { userId } = req.params;
    const password = req.body.password;
    const userJson = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        address: req.body.address,
        city: req.body.city,
        email: req.body.email,
        phone: req.body.phone,
        
    };

    if(userId){
        admin.auth().updateUser(userId,{
            email: userJson.email,
            emailVerified: true,
            password: password
        }).then((userRecord) => {
            const docRef = db.collection('admin').doc(userId).update(userJson);
            res.status(200).send(docRef);
        }).catch((e) => {
            res.status(400).send(e.message);
        });
    } else {
        res.sendStatus(404);
    }
});

app.delete('/api/delete/users/:userId', authTokenVerify, async (req, res) => {
    const { userId } = req.params;
    const docRef = db.collection('employees').doc(userId);

    if(!docRef){
        res.sendStatus(404);
    } else {
        await admin.auth().deleteUser(userId);
        await docRef.delete();
        res.sendStatus(200);
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});