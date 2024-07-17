const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const port = process.env.PORT || 3001;
require('dotenv').config();

// Middleware
app.use(express.json());
app.use(cors());
const upload = multer({ dest: 'uploads/' });

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@men-job-portal.ddye6po.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'xhkharis2@gmail.com',
    pass: 'ftnt bpdh lfbq jgkx'
  }
});
async function run() {
  try {
    await client.connect();
    const db = client.db("MenJobPortal");
    const jobsCollections = db.collection("demoJobs");
    const usersCollection = db.collection("users");

    app.post("/post-job", async (req, res) => {
      try {
        let body = req.body;

        if (body.data) {
          body = body.data;
        }

        if (body._id) {
          body._id = new ObjectId(body._id);
        }

        body.createdAt = new Date();

        let companyId = 'v3-company-id';
        if (body.companyName) {
          companyId = body.companyName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '');
        }
        body.companyId = companyId;

        let job = null;
        if (body._id) {
          job = await jobsCollections.findOne({ _id: body._id });
        }

        let result;
        if (job == null) {
          result = await jobsCollections.insertOne(body);
        } else {
          result = await jobsCollections.findOneAndUpdate(
            { _id: body._id },
            { $set: body },
            { returnOriginal: false, upsert: true }
          );
        }
        console.log(result.insertedId)
        if (result.insertedId || result.value) {
          return res.status(200).send(result);
        } else {
          return res.status(404).send({
            message: "Cannot Insert or Update, Try Again Later!",
            status: false
          });
        }
      } catch (error) {
        console.error(error);
        return res.status(500).send({
          message: "Internal Server Error",
          status: false
        });
      }
    });

    app.get("/all-jobs", async (req, res) => {
      try {
        const jobs = await jobsCollections.find({}).toArray();
        console.log(jobs)
        res.send(jobs);
      } catch (error) {
        console.error(error);
        return res.status(500).send({
          message: "Internal Server Error",
          status: false
        });
      }
    });

    app.get("/company-jobs/:companyId", async (req, res) => {
      const companyId = req.params.companyId;

      try {
        const jobs = await jobsCollections.find({ companyId }).toArray();
        res.json(jobs);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    app.get("/location-jobs/:jobLocation", async (req, res) => {
      const jobLocation = req.params.jobLocation;

      try {
        const jobs = await jobsCollections.find({ jobLocation }).toArray();
        res.json(jobs);
        console.log(res)
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });
    app.get("/categories/:category", async (req, res) => {
      const category = req.params.category;
      try {
        const jobs = await jobsCollections.find({ category }).toArray();
        res.json(jobs);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    })

    app.get("/all-jobs/:id", async (req, res) => {
      const id = req.params.id;
      console.log(req.params);
      const job = await jobsCollections.findOne({
        _id: new ObjectId(id)
      });
      console.log(job);
      res.send(job)
    });

    app.get("/jobdetails/:id", async (req, res) => {
      const jobId = req.params.id;

      if (!ObjectId.isValid(jobId)) {
        return res.status(400).send({ message: 'Invalid job ID' });
      }

      try {
        const job = await jobsCollections.findOne({ _id: new ObjectId(jobId) });
        if (!job) {
          return res.status(404).send({ message: 'Job not found' });
        }
        res.json(job);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    app.get("/myJobs/:email", async (req, res) => {
      const Jobs = await jobsCollections.find({ postedBy: req.params.email }).toArray();
      res.send(Jobs);
    });

    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      console.log(req.params);
      const filter = { _id: new ObjectId(id) };
      const result = await jobsCollections.deleteOne(filter);
      res.send(result);
    });

    // Signup endpoint
    app.post("/signup", async (req, res) => {
      const { firstName, lastName, email, password, phoneNumber } = req.body;

      try {
        // Check if user with provided email already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a unique user ID
        const userId = new ObjectId(); // Generate ObjectId

        // Create user document
        const newUser = {
          _id: userId, // Assign ObjectId as the user ID
          firstName,
          lastName,
          email,
          password: hashedPassword,
          phoneNumber,
        };

        // Insert user into the database
        await usersCollection.insertOne(newUser);

        res.status(201).json({ message: "User created successfully", userId }); // Return userId in the response
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    });

    // Login endpoint
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      try {
        // Check if user with provided email exists
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

        // Send back the token, user's name, and user's ID
        res.json({ token, name: user.firstName, userId: user._id });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    });
    app.get('/user-info/:email', async (req, res) => {
      const userEmail = req.params.email;
      console.log(userEmail, "this is user email")

      try {
        // Find the user by email
        const user = await usersCollection.findOne({ email: userEmail });
        console.log("🚀 ~ app.get ~ user:", user)

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
      } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    });
    app.post('/apply', upload.single('cvFile'), (req, res) => {
      const { email, coverLetter, companyemail, companyjob, companyname, name } = req.body;
      const cvFile = req.file;

      if (!email || !coverLetter || !cvFile || !name) {
        return res.status(400).send('All fields are required.');
      }

      const companywebsite = "yourcompany.com";

      const mailOptionsToUser = {
        from: companyemail,
        to: email,
        subject: 'Job Application Received',
        html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px; background-color: #f9f9f9;">
                  <h2 style="text-align: center; color: #333333;">Job Application Received</h2>
                  <p style="font-size: 16px; color: #555555;">Dear Applicant,</p>
                  <p style="font-size: 16px; color: #555555;">
                      Thank you for applying for the position of <strong>${companyjob}</strong> at <strong>${companyname}</strong>. We have received your application.
                  </p>
                  <p style="font-size: 16px; color: #555555; text-align: center;">
                  You can visit our website for more job opportunities: <a href="http://localhost:3000/" style="color: #1a73e8;">${companywebsite}</a>
                  </p>
                  <p style="font-size: 16px; color: #555555;">
                      Best regards,<br/>
                      <strong>${companyname}</strong>
                  </p>
              </div>
          `
      };

      const mailOptionsToCompany = {
        from: email,
        to: companyemail,
        subject: 'New Job Application',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px; background-color: #f9f9f9;">
        <h2 style="text-align: center; color: #333333;">New Job Application Received</h2>
        <p style="font-size: 16px; color: #555555;">A new job application has been received from <strong>${email}</strong>.</p>
        <p style="font-size: 16px; color: #555555;">
            <strong>Job Title:</strong> ${companyjob}<br/>
            <strong>Applicant Name:</strong> ${name}
        </p>
        <p style="font-size: 16px; color: #555555;"><strong>Cover Letter:</strong></p>
        <div style="font-size: 16px; color: #555555; border-left: 4px solid #dddddd; padding-left: 16px; margin: 16px 0;">
            ${coverLetter}
        </div>
    </div>
    `,
        attachments: [
          {
            filename: cvFile.originalname,
            path: cvFile.path
          }
        ]
      };


      // Send email to user
      transporter.sendMail(mailOptionsToUser, (error, info) => {
        if (error) {
          console.error('Error sending email to user:', error);
        } else {
          console.log('Email sent to user:', info);
        }
      });

      // Send email to company
      transporter.sendMail(mailOptionsToCompany, (error, info) => {
        if (error) {
          console.error('Error sending email to company:', error);
          return res.status(500).send('Error submitting application.');
        } else {
          console.log('Email sent to company:', info);
          res.status(200).json({
            success: true,
            message: "Application Submitted Successfully!",
            data: mailOptionsToCompany
          })
        }
      });
    });


    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Osama!');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});