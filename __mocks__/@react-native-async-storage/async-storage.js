// Jest has no native AsyncStorage; every test uses the in-memory one the package provides
module.exports = require("@react-native-async-storage/async-storage/jest/async-storage-mock");
