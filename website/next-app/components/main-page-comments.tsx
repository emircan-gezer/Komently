"use client";

import { CommentSection } from "komently-sdk";
import "komently-sdk/dist/styles/komently.css";

export default function Comments() {
    return <CommentSection publicId="demo" baseUrl={process.env.NEXT_PUBLIC_KOMENTLY_BASE_URL} />;
}