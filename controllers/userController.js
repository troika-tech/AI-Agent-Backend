// controllers/userController.js (barrel)
module.exports = {
  ...require("./user/accountController"),
  ...require("./user/dataController"),
};

