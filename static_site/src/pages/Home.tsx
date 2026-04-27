import React, { useState } from "react";
import { Grid, List, ListItemButton } from "@mui/material";
import { useTitle } from "@/helpers/title";

const srcCollection: Record<string, { text: string; src: string }> = {
  About: { text: "關於我", src: "https://faryne.github.io/" },
  Blog: { text: "部落格", src: "https://blog.faryne.dev/" },
};
const Home: React.FC = () => {
  const [iframeSrc, setIframeSrc] = useState(srcCollection.About.src);
  useTitle("首頁");
  return (
    <>
      <Grid container>
        <Grid size={2}>
          <List>
            {Object.entries(srcCollection).map((v) => (
              <ListItemButton
                key={v[1].src}
                disabled={iframeSrc === v[1].src}
                title={v[1].text}
                component={"a"}
                href={v[1].src}
                onClick={(e) => {
                  e.preventDefault();
                  setIframeSrc(v[1].src);
                }}
              >
                {v[1].text}
              </ListItemButton>
            ))}
          </List>
        </Grid>
        <Grid size={10}>
          {iframeSrc && (
            <iframe
              src={iframeSrc}
              style={{ width: "100%", border: 0, minHeight: "700px" }}
            />
          )}
        </Grid>
      </Grid>
    </>
  );
};

export default Home;
