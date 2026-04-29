const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxnJ53DMvXsxzkdkAMrtixvwODsxOjQJar-sakGPW-7foi_mGVvRsFlfWSkaApmxJTm/exec";

module.exports = async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        state: "unreachable",
        rows: [],
        message: `Apps Script request failed with status ${response.status}`,
      });
    }

    const payload = await response.json();

    return res.status(200).json({
      state: payload.state || "unreachable",
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      source: "apps_script",
    });
  } catch (error) {
    return res.status(502).json({
      state: "unreachable",
      rows: [],
      message: error.message,
    });
  }
};
