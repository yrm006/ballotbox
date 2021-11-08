import { Application, Router, send } from "https://deno.land/x/oak/mod.ts";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { SmtpClient } from "https://raw.githubusercontent.com/yrm006/deno-smtp/master/smtp.ts"; // Original: "https://deno.land/x/smtp/mod.ts"

// #Configulations#
const g_nPort = 8110;
const g_sPassword = "11C87255-878A-4F04-94B6-490FDE1E9BE6";
const g_sMailSMTP = "127.0.0.1";
const g_sMailFrom = '"Ballotbox" <xxx@yyy.zzz>';
const g_sMailSubj = "your ballot-url is";
const g_sMailURL  = "http://localhost:8110/";



let g_bOpen = false;

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
                root: './www-front',
            });
        }
    }
}



const router = new Router();{
    router.get("/", async function(ctx, next){
        const code = ctx.request.url.search.substring(1);

        if(code === ""){
            ctx.response.redirect("code.html");
        }else{
            let r = null;
            const db = new DB("_.db");{
                r = db.queryEntries("select sCode from TBallot where sCode=? and dBallotted is NULL", [code]);
                db.close();
            }

            if(r.length){
                await next();
            }else{
                ctx.response.redirect("error.html");
            }
        }
    });

    router.get('/photo/:id-:filename', async function(ctx){
        await send(ctx, `${ctx.params.id}-${ctx.params.filename}`, {
            root: './entry-photo',
        });
    });

    router.get('/video/:id-:filename', async function(ctx){
        await send(ctx, `${ctx.params.id}-${ctx.params.filename}`, {
            root: './entry-video',
        });
    });

    router.get("/entries", async function(ctx){
        let r = null;
        const db = new DB("_.db");{
            r = db.queryEntries("select id,sTitle,sComment,sPhotoFile,sVideoFile from TEntry ORDER BY RANDOM()");
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
              hostname: g_sMailSMTP,
            });
            await smtp.send({
                from: g_sMailFrom,
                to: email,
                subject: g_sMailSubj,
                content: `${g_sMailURL}?${code}`,
            });
            await smtp.close();
                                                                            console.log("a ballot mail was sent. ", email);
        }

        if(code){
                                                                            console.log(`code: ${code}`);
            ctx.response.status = 200;
        }else{
            ctx.response.status = 500;
            ctx.response.body = "The email address can't be used.";
        }
    });

    router.post("/ballot", async function(ctx){
        const form = await ctx.request.body().value;
        let id = Number.parseInt(form.get("id"));
        let code = form.get("code");

        const db = new DB("_.db");{
            db.query("UPDATE TBallot SET pEntry=?, dBallotted=CURRENT_TIMESTAMP WHERE sCode=? and dBallotted is NULL", [id, code]);
            if(db.changes === 1){
                ctx.response.redirect("thanks.html");
            }else{
                ctx.response.redirect("error.html");
            }
        }
    });
}

const app = new Application();{
    app.use(async function(ctx, next){
                                                                        console.log(`--- ${new Date()} - ${ctx.request.method} ${ctx.request.url.pathname}`);
        await next();
    });
    app.use(oakCors());
    app.use(isOpen);
    app.use(router.routes());
    app.use(router.allowedMethods());
    app.use(async function(ctx){
        if(ctx.request.method === "GET"){
            try{
                await send(ctx, ctx.request.url.pathname, {
                    root: './www-front',
                    index: "index.html",
                });
            }catch(e){}
        }
    });
                                                                        console.log('running on port ', g_nPort);
    await app.listen({
        port: g_nPort,
        // secure: true,
        // certFile: "server_crt.pem",
        // keyFile: "server_key.pem",
    });
}


