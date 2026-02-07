import { BankMappings, type Rate } from "@/types/rates.ts";
import {
  Stack,
  Box,
  TextField,
  Radio,
  List,
  ListItem,
  Typography,
  RadioGroup,
  FormControlLabel,
} from "@mui/material";
import { useState } from "react";

export interface IRateCalculator {
  rates: Rate[];
  currencies: { [p in string]: string };
}

export function RateCalculator(props: IRateCalculator) {
  const [direction, setDirection] = useState<number | null>(null);
  const [input, setInput] = useState<number>(0);
  return (
    <>
      <Stack direction={"row"} textAlign={"center"} spacing={2}>
        <Box>
          <TextField
            type={"number"}
            value={input}
            onChange={(e) => setInput(parseInt(e.target.value, 10))}
            placeholder={"輸入數字"}
            label={"請輸入新台幣金額"}
          />
        </Box>
        <Box sx={{ textAlign: "center" }}>
          <RadioGroup row sx={{ textAlign: "justify" }}>
            <FormControlLabel
              control={<Radio />}
              label={"銀行買入"}
              value={0}
              onChange={() => setDirection(0)}
            />
            <FormControlLabel
              control={<Radio />}
              label={"銀行賣出"}
              value={1}
              onChange={() => setDirection(1)}
            />
          </RadioGroup>
        </Box>
      </Stack>
      <List>
        {direction !== null &&
          input > 0 &&
          props.rates.map((v) => (
            <ListItem>
              <Typography variant={"body1"}>
                {BankMappings[v.service_name] ?? ""}
                {direction === 0 ? "買入" : "賣出"}
                {props.currencies[v.base] ?? ""}-{" "}
                {input * (direction === 0 ? v.buy_rate : v.sell_rate)}
              </Typography>
            </ListItem>
          ))}
      </List>
    </>
  );
}
