require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bnuku.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const marathonsCollection = client
      .db("MarathonHubDB")
      .collection("marathons");

    // marathons related api
    app.post("/marathons", async (req, res) => {
      const newMarathon = req.body;
      const result = await marathonsCollection.insertOne(newMarathon);
      res.send(result);
    });

    app.get("/marathons", async (req, res) => {
      const cursor = marathonsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/marathons/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await marathonsCollection.findOne(query);
      res.send(result);
    });

    // user registration related api
    app.post("/registrations", async (req, res) => {
      const registration = req.body;
      const { marathonId, email } = registration;

      try {
        const existingRegistration = await client
          .db("MarathonHubDB")
          .collection("registrations")
          .findOne({ marathonId, email });

        if (existingRegistration) {
          return res.status(400).send({
            success: false,
            message: "You have already registered for this marathon.",
          });
        }

        const result = await client
          .db("MarathonHubDB")
          .collection("registrations")
          .insertOne(registration);

        const updateResult = await client
          .db("MarathonHubDB")
          .collection("marathons")
          .updateOne(
            { _id: new ObjectId(marathonId) },
            { $inc: { totalRegistrationCount: 1 } }
          );

        res.send({ success: true, result, updateResult });
      } catch (error) {
        res.status(500).send({ success: false, error: "Failed to register" });
      }
    });

    app.get("/registrations/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const registrations = await client
          .db("MarathonHubDB")
          .collection("registrations")
          .find({ email })
          .toArray();

        res.send(registrations);
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch registrations" });
      }
    });

    // query parameter
    app.get("/registrations", async (req, res) => {
      const { email } = req.query; // Get email from query parameters

      if (!email) {
        return res
          .status(400)
          .send({ success: false, message: "Email is required" });
      }

      try {
        const registrations = await client
          .db("MarathonHubDB")
          .collection("registrations")
          .find({ email })
          .toArray();

        res.send(registrations);
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch registrations" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Marathon server is running");
});

app.listen(port, () => {
  console.log(`Marathon Hub server is running on port: ${port}`);
});
