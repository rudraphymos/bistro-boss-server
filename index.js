const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.y7jbt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const menuCollection = client.db("bistroDb").collection("menu");
        const userCollection = client.db("bistroDb").collection("users");
        const reviewsCollection = client.db("bistroDb").collection("reviews");
        const cartsCollection = client.db("bistroDb").collection("carts");

        //jwt related apis
        app.post('/jwt', (req, res) => {
            const token = jwt.sign(req.body, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });

        //middlewares
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send('Unauthorized request');
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send('Token is not valid');
                }
                req.decoded = decoded;
                next();
            });
        };

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send('Unauthorized request');
            }
            next();
        };

        //user related apis
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const cursor = userCollection.find({});
            const users = await cursor.toArray();
            res.send(users);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send('Unauthorized request');
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                res.send({ status: 'User already exists' });
                return;
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        });

        //menu related apis
        app.get('/menu', async (req, res) => {
            const cursor = menuCollection.find({});
            const menu = await cursor.toArray();
            res.send(menu);
        });

        app.get('/reviews', async (req, res) => {
            const cursor = reviewsCollection.find({});
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const cursor = cartsCollection.find(query);
            const carts = await cursor.toArray();
            res.send(carts);
        });

        app.post('/carts', async (req, res) => {
            const cart = req.body;
            const result = await cartsCollection.insertOne(cart);
            res.json(result);
        });

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bistro Boss Server is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

