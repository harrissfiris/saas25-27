const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserByCode = async (req, res) => {
  try {
    const user = await User.findOne({ userCode: req.params.code });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUsersByInstitution = async (req, res) => {
  try {
    const users = await User.find({ institutionId: req.params.institutionId });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// GET /users/by-gmail/:gmail
exports.getUserInfoByGmail = async (req, res) => {
  try {
    const gmail = req.params.gmail;

    if (!gmail) {
      return res.status(400).json({ message: "Missing gmail parameter" });
    }

    const user = await User.findOne({ gmail });

    if (!user) {
      return res.status(404).json({ message: "User not found with that Gmail" });
    }

    res.status(200).json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      gmail: user.gmail,
      userCode: user.userCode,
      role: user.role,
      institutionId: user.institutionId
    });

  } catch (err) {
    console.error("❌ Error fetching user by Gmail:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};


exports.assignUserCode = async (req, res) => {
  const { email, userCode } = req.body;

  if (!email || !userCode) {
    return res.status(400).json({ message: "Email and userCode are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.userCode = userCode;
    await user.save();

    res.json({ message: "User code assigned", user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.registerUser = async (req, res) => {
  const { email, password, fullName, role, institutionId, userCode } = req.body;

  if (!email || !password || !role || !fullName || !institutionId || !userCode) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({ email, fullName, role, password: hashed, institutionId, userCode });
    await newUser.save();

    // const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, {
    //   expiresIn: "1h",
    // });

    res.status(201).json({
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        institutionId: institutionId,
        userCode: userCode
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
    console.error(err);
  }
};

// GET /users/:id/courses
exports.getCoursesForStudent = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("courses role");
    if (!user)      return res.status(404).json({ message: "User not found" });
    if (user.role !== "student")
      return res.status(400).json({ message: "Not a student" });

    res.json({courses: user.courses });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// GET /users/:id/instructor-courses
exports.getCoursesForInstructor = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("courses role");
    if (!user)               return res.status(404).json({ message: "User not found" });
    if (user.role !== "instructor")
      return res.status(400).json({ message: "Not an instructor" });
    res.json({ courses: user.courses  });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// GET /users/count/by-institution/:institutionId
exports.getUserCountByInstitution = async (req, res) => {
  try {
    const institutionId = req.params.institutionId;
    const count = await User.countDocuments({ institutionId });
    res.json({ institutionId, count });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.linkGoogleAccount = async (req, res) => {
  const { userCode, googleId, gmail, fullName } = req.body;

  if (!userCode || !googleId || !gmail) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const user = await User.findOne({ userCode });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Optional: Check if googleId already exists
    const conflictUser = await User.findOne({ googleId });
    if (conflictUser && conflictUser.userCode !== userCode) {
      return res.status(409).json({ message: "Google account already linked to another user" });
    }

    user.googleId = googleId;
    user.gmail = gmail;
    if (!user.fullName) user.fullName = fullName;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Google account linked successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        gmail: user.gmail,
        googleId: user.googleId,
        role: user.role
      }
    });

  } catch (err) {
    console.error("❌ Error linking Google account:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};



