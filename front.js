//% deno run --allow-net --allow-read --allow-write front.js
import { Application, Router, send } from "https://deno.land/x/oak/mod.ts";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { SmtpClient } from "https://raw.githubusercontent.com/yrm006/deno-smtp/master/smtp.ts"; // Original: "https://deno.land/x/smtp/mod.ts"



let g_bOpen = false;
const g_sPassword = "aoep8754xx";

async function isOpen(ctx, next){
    if(ctx.request.url.pathname === `/${g_sPassword}`){
        const open = ctx.request.url.search.substring(1);
        if(open === ""){
            ctx.response.body = g_bOpen ? "opening" : "closing";
        }else{
            g_bOpen = (open === "open");
            ctx.response.body = g_bOpen ? "opened" : "closed";
        }
    }else{
        if(g_bOpen){
            await next();
        }else
        {
            await send(ctx, "close.html", {
                root: `${Deno.cwd()}/www-front`,
            });
            }
    }
}



const router = new Router();{
    router.get("/", async function(ctx, next){
        const code = ctx.request.url.search.substring(1);

        if(code === ""){
            ctx.response.redirect("/code.html");
        }else{
            let r = null;
            const db = new DB("_.db");{
                r = db.queryEntries("select sCode from TBallot where sCode=? and dBallotted is NULL", [code]);
                db.close();
            }

            if(r.length){
                await next();
            }else{
                ctx.response.redirect("/error.html");
            }
        }
    });

    router.get('/photo/:id-:filename', async function(ctx){
        await send(ctx, `${ctx.params.id}-${ctx.params.filename}`, {
            root: './entry-photo',
        });
    });

    router.get("/entries", async function(ctx){
        let r = null;
        const db = new DB("_.db");{
            r = db.queryEntries("select id,sTitle,sComment,sPhotoFile from TEntry ORDER BY RANDOM()");
            db.close();
        }
        ctx.response.body = r;
    });

    router.post("/code", async function(ctx){
        const obj = await ctx.request.body().value;
        let email = obj.email;

        let code;

        const db = new DB("_.db");
        let r = db.queryEntries("SELECT sCode from TBallot WHERE sEmail=? and dBallotted is NULL", [email]);
        if(0 < r.length){
            code = r[0].sCode;
        }else{
            try{
                db.query("INSERT INTO TBallot (sEmail) VALUES (?)", [email]);
                code = db.queryEntries("SELECT sCode from TBallot where id=last_insert_rowid()")[0].sCode;
            }catch(e){}
        }

        // send mail
        {
            const smtp = new SmtpClient({content_encoding:"8bit"});
            await smtp.connect({
              hostname: "127.0.0.1",
            });
            await smtp.send({
                from: '"Ballotbox" <fkpc@kani-robocon.com>',
                to: email,
                subject: "your ballot-url is",
                content: `http://192.168.24.125:8100/?${code}`,
            });
            await smtp.close();
                                                                            console.log("a ballot mail was sent. ", email);
        }

        if(code){
                                                                            console.log(`code: ${code}`);
            ctx.response.status = 200;
        }else{
            ctx.response.status = 500;
            ctx.response.body = "そのアドレスは利用できません";
        }
    });

    router.post("/ballot", async function(ctx){
        const form = await ctx.request.body().value;
        let id = Number.parseInt(form.get("id"));
        let code = form.get("code");

        const db = new DB("_.db");{
            db.query("UPDATE TBallot SET pEntry=?, dBallotted=CURRENT_TIMESTAMP WHERE sCode=? and dBallotted is NULL", [id, code]);
            if(db.changes === 1){
                ctx.response.redirect("/thanks.html");
            }else{
                ctx.response.redirect("/error.html");
            }
        }
    });
}

const app = new Application();{
    const port = 8100;

    app.use(async function(ctx, next){
                                                                        console.log(`--- ${new Date()} - ${ctx.request.method} ${ctx.request.url.pathname}`);
        await next();
    });
    app.use(oakCors());
    app.use(isOpen);
    app.use(router.routes());
    app.use(router.allowedMethods());
    app.use(async function(ctx){
        try{
            await send(ctx, ctx.request.url.pathname, {
                root: `${Deno.cwd()}/www-front`,
                index: "index.html",
            });
        }catch(e){}
    });
                                                                        console.log('running on port ', port);
    await app.listen({
        port: port,
        // secure: true,
        // certFile: "server_crt.pem",
        // keyFile: "server_key.pem",
    });
}


