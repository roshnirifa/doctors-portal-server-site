
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config()
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// CONNEET TO MONGODB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qitru.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        console.log('db connected');
        const serviceCollections = client.db("doctors_portal").collection('services');
        const bookingCollections = client.db("doctors_portal").collection('bookings');
        const userCollections = client.db("doctors_portal").collection('users');

        function verifyJWT(req, res, next) {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = authHeader.spilt(' ')[1]
            // verify a token symmetric
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
                if (err) {
                    return res.status(403).send({ messege: "Forbiden access" })
                }
                req.decoded = decoded;
                next()
            });
        }

        //  get all the service
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollections.find(query);
            const services = await cursor.toArray();
            res.send(services)
        })

        // all users (update a document)
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollections.updateOne(filter, updateDoc, options);
            var token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.send({ result, token })
        })


        // available appoinment
        app.get('/available', async (req, res) => {
            const date = req.query.date;
            //1. get all services

            const services = await serviceCollections.find().toArray();

            // 2. get the booking of that day
            const query = { date: date };
            const bookings = await bookingCollections.find(query).toArray();

            // 3. for each service, find bookings for that service
            services.forEach(service => {
                const serviceBookings = bookings.filter(b => b.treatment === service.name);
                const booked = serviceBookings.map(s => s.slot);
                const available = service.slots.filter(s => !booked.includes(s))
                service.available = available;
            })
            res.send(services)
        })
        // my appppointment booking
        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollections.find(query).toArray();
                return res.send(bookings);
            }
            else {
                req.status(403).send({ messege: "forbiden access" });
            }
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollections.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollections.insertOne(booking);
            return res.send({ success: true, result })
        })


    } finally {
        //   await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from doctor uncle!')
})

app.listen(port, () => {
    console.log(`Doctors app listening on port ${port}`)
})