
const express = require('express');
const cors = require('cors');
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
            res.send(result)
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
        app.get('/booking', async (req, res) => {
            const patient = req.query.patient;
            const query = { patient: patient };
            const bookings = await bookingCollections.find(query).toArray();
            res.send(bookings);
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