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

    // query parameter and search
    app.get("/registrations", async (req, res) => {
      const { email, search } = req.query;

      if (!email) {
        return res
          .status(400)
          .send({ success: false, message: "Email is required" });
      }

      try {
        const query = { email };

        if (search) {
          query.title = { $regex: search, $options: "i" }; 
        }

        const registrations = await client
          .db("MarathonHubDB")
          .collection("registrations")
          .find(query)
          .toArray();

        res.send(registrations);
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch registrations" });
      }
    });

    // Update registration by ID
    app.put("/registrations/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;

      try {
        const result = await client
          .db("MarathonHubDB")
          .collection("registrations")
          .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

        if (result.modifiedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Registration not found or no changes made",
          });
        }

        res.send({
          success: true,
          message: "Registration updated successfully",
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to update registration" });
      }
    });

    // Delete registration by ID
    app.delete("/registrations/:id", async (req, res) => {
      const id = req.params.id;

      try {
        // Find the registration to get the marathonId
        const registration = await client
          .db("MarathonHubDB")
          .collection("registrations")
          .findOne({ _id: new ObjectId(id) });

        if (!registration) {
          return res
            .status(404)
            .send({ success: false, message: "Registration not found" });
        }

        const marathonId = registration.marathonId;

        // Delete the registration
        const result = await client
          .db("MarathonHubDB")
          .collection("registrations")
          .deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Failed to delete registration" });
        }

        // Decrease the totalRegistrationCount in the marathon document
        const updateResult = await client
          .db("MarathonHubDB")
          .collection("marathons")
          .updateOne(
            { _id: new ObjectId(marathonId) },
            { $inc: { totalRegistrationCount: -1 } }
          );

        if (updateResult.modifiedCount === 0) {
          return res.send({
            success: true,
            message: "Registration deleted, but marathon count not updated",
          });
        }

        res.send({
          success: true,
          message: "Registration deleted successfully",
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message: "Failed to delete registration",
        });
      }
    });

    // Fetch marathons created by the logged-in user
    app.get("/my-marathons", async (req, res) => {
      const { email } = req.query;

      if (!email) {
        return res
          .status(400)
          .send({ success: false, message: "User email is required" });
      }

      try {
        const marathons = await client
          .db("MarathonHubDB")
          .collection("marathons")
          .find({ email: email })
          .toArray();

        res.send({ success: true, marathons });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch marathons" });
      }
    });

    // Update marathon by ID
    app.put("/marathons/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;

      try {
        const result = await client
          .db("MarathonHubDB")
          .collection("marathons")
          .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

        if (result.modifiedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Marathon not found or no changes made",
          });
        }

        res.send({ success: true, message: "Marathon updated successfully" });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update marathon" });
      }
    });

    // Delete marathon by ID
    app.delete("/marathons/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await client
          .db("MarathonHubDB")
          .collection("marathons")
          .deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Marathon not found",
          });
        }

        res.send({ success: true, message: "Marathon deleted successfully" });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to delete marathon" });
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
