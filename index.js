const express = require("express");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middle ware
app.use(cors());
app.use(express.json());

// db access

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jbprl6s.mongodb.net/?retryWrites=true&w=majority`;

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

    const allContestCollection = client.db("contestHUB").collection("contests");
    const newContestCollection = client
      .db("contestHUB")
      .collection("newContest");
    const usersCollection = client.db("contestHUB").collection("users");
    const paymentsCollection = client.db("contestHUB").collection("payments");
    const winnersCollection = client.db("contestHUB").collection("winners");
    const submissionCollection = client
      .db("contestHUB")
      .collection("submission");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //   token verify and cutom middleware
    const verifyToken = (req, res, next) => {
      //   console.log("inside veryfy token", req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "UnAuthorized Access" });
      }
      const token = req.headers.authorization;
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "UnAuthorized Access" });
        }
        req.decoded = decoded;
        // console.log("email decoded", req.decoded.email);
        next();
      });
    };

    //   admin verify

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      //   console.log("decoded email", email);
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Acceess" });
      }
      next();
    };

    //   creator / editor verify

    const verifyCreator = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isCreator = user?.role === "creator";
      if (!isCreator) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    //   contests data get

    /**
     * new contest data created by editor . it should be keep a new collection
     */

    app.get("/newContest", async (req, res) => {
      const result = await newContestCollection.find().toArray();
      res.send(result);
    });

    app.post("/newContest", async (req, res) => {
      const newitem = req.body;
      const result = await newContestCollection.insertOne(newitem);
      res.send(result);
    });

    app.get("/newContest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await newContestCollection.findOne(filter);
      res.send(result);
    });

    //   data updated
    app.put("/newContest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedData = req.body;
      //   console.log(updatedData);

      const updatedDoc = {
        $set: {
          contest_name: updatedData.contest_name,
          image: updatedData.image,
          description: updatedData.description,
          contest_price: updatedData.contest_price,
          prize_money: updatedData.prize_money,
          instruction: updatedData.instruction,
          tags: updatedData.tags,
          deadline: updatedData.deadline,
          participation_count: updatedData.participation_count,
        },
      };
      const result = await newContestCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/newContest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "Approved",
        },
      };
      const result = await newContestCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //   my new contest delete operation
    app.delete("/newContest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await newContestCollection.deleteOne(filter);
      res.send(result);
    });

    //   all contest api

    app.get("/contests", async (req, res) => {
      const result = await allContestCollection.find().toArray();
      res.send(result);
    });

    app.get("/contests/:id", async (req, res) => {
      const id = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await allContestCollection.findOne(filter);
      res.send(result);
    });

    app.post("/contests", async (req, res) => {
      const item = req.body;
      //   const query = { _id: item._id };
      //   const existContest = await allContestCollection.findOne(query);
      //   if (existContest) {
      //     return res
      //       .status(403)
      //       .send({ message: "Already exist", insertedId: null });
      //   }
      const result = await allContestCollection.insertOne(item);
      res.send(result);
    });
    //   user related api

    //   userinfo received from client side

    app.get(
      "/users",
      verifyToken,
      verifyAdmin,

      async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
      }
    );

    //   admin email verify
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const filter = { email: email };
      const user = await usersCollection.findOne(filter);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    //   creator/editor email verify
    app.get("/users/creator/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let creator = false;
      if (user) {
        creator = user?.role === "creator";
      }
      res.send({ creator });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existUser = await usersCollection.findOne(query);
      if (existUser) {
        return res.send({
          message: "user Already exist here",
          insertedId: null,
        });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //   user make admin
    app.patch("/users/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //   user make Editor
    app.patch(
      "/users/creator/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "creator",
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    //   user delete
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    /**
     * payment related =====> stripe
     *
     */

    //   payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const totalPrice = parseInt(price * 100);
      //   console.log(totalPrice, "amout inside");
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    //   payment details
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      console.log("payment info", payment);
      const paymentResult = await paymentsCollection.insertOne(payment);
      res.send({ paymentResult });
    });

    //   user get payment details
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbiddenaccess" });
      }
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

    /**
     * contest submission data
     */

    app.get("/submission", async (req, res) => {
      const result = await submissionCollection.find().toArray();
      res.send(result);
    });

    app.get("/submission/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await submissionCollection.findOne(filter);
      res.send(result);
    });
    app.post("/submission", async (req, res) => {
      const item = req.body;
      const result = await submissionCollection.insertOne(item);
      res.send(result);
    });
    app.patch("/submission/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { contest_id: id };

      const updateDoc = {
        $set: {
          status: "winner",
        },
      };
      const result = await submissionCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    /**
     * winner collection
     */

    app.get("/winner/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { participant_email: email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbiddenaccess" });
      }
      const result = await winnersCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/winner", async (req, res) => {
      const winner = req.body;

      const result = await winnersCollection.insertOne(winner);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// server is running or not it checking

app.get("/", (req, res) => {
  res.send("contestHub is running");
});

app.listen(port, () => {
  console.log(`contestHub is running on port:${port}`);
});
