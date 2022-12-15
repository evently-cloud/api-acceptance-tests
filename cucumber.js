module.exports = {
  default: {
    require: ["step-definitions/**/*.ts"],
    requireModule: ["ts-node/register"],
    format: ["@cucumber/pretty-formatter"],
    publishQuiet: true,
    worldParameters: {
      eventlyUrl: process.env.EVENTLY_URL,
      eventlyToken: process.env.EVENTLY_TOKEN
    }
  }
}
